"""Arquitectura del modelo v2 (DogNet v2): EfficientNetB0 multitarea.

Un solo backbone EfficientNetB0 (preentrenado en ImageNet y afinado con las
fotos de PERREQUE) con tres cabezas sobre el vector de 1280-d:

- cls_head  -> 20 razas + "Otro" (otra raza / mestizo) + 4 tipos de "no perro"
               (gato, peluche, otro animal, objeto/persona). Clases y orden en el
               metadato del checkpoint (models/dognet_v2.pt -> meta.classes).
- size_head -> pequeno / mediano / grande.
- age_head  -> cachorro / adulto / senior.

AgeHead es una cabeza aparte (models/dognet_age.pt, experiments/train_age.py) que
estima la edad en meses (distribucion por rangos) sobre el mismo vector de 1280-d.

Se comparte entre el entrenamiento (experiments/train_v2.py) y el servicio.
"""
import math

import torch
import torch.nn as nn
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

EMBED_DIM = 1280


class DogNetV2(nn.Module):
    def __init__(self, n_classes: int, n_sizes: int = 3, n_ages: int = 3,
                 pretrained: bool = True, dropout: float = 0.3) -> None:
        super().__init__()
        base = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None)
        self.features = base.features
        self.avgpool = base.avgpool
        self.dropout = nn.Dropout(dropout)
        self.cls_head = nn.Linear(EMBED_DIM, n_classes)
        self.size_head = nn.Linear(EMBED_DIM, n_sizes)
        self.age_head = nn.Linear(EMBED_DIM, n_ages)

    def embed(self, x: torch.Tensor) -> torch.Tensor:
        fmap = self.features(x)                       # [N, 1280, 7, 7]
        return torch.flatten(self.avgpool(fmap), 1)   # [N, 1280]

    def heads(self, feat: torch.Tensor):
        h = self.dropout(feat)
        return self.cls_head(h), self.size_head(h), self.age_head(h)

    def forward(self, x: torch.Tensor):
        return self.heads(self.embed(x))


# Rangos de edad (meses) del estimador: los limites de las etiquetas de PetFinder.my
# (1.5 2.5 3.5 4.5 7.5 12.5) y DogAge (24 y 72). Dentro de un rango se asume densidad
# uniforme en log(meses); por eso no hay rangos mas finos para adultos: no hay
# etiquetas que los distingan. (El limite 29.5 de PetFinder.my se reparte en
# proporcion: un rango 24-29.5 aparte se llenaba de adultos por ser la interseccion
# de las dos fuentes y daba "2 años" con confianza falsa.)
AGE_EDGES = [0.0, 1.5, 2.5, 3.5, 4.5, 7.5, 12.5, 24.0, 72.0, 180.0]
# Etapa que se muestra: cachorro = menos de 1 anio (12.5 meses, limite de PetFinder.my),
# adulto 1-6 anios, senior 6+. Umbral de cachorro: P(edad < 12.5 meses) >= 0.5, que es lo
# mismo que "la mediana de la edad estimada es menor a 12.5 meses".
PUPPY_MAX_MONTHS = 12.5
STAGES = [("cachorro", 0.0, PUPPY_MAX_MONTHS), ("adulto", PUPPY_MAX_MONTHS, 72.0), ("senior", 72.0, 1e9)]
# Etapas de DogAge (joven 0-2 / adulto 2-6 / senior 6+), las de la cabeza age_head de DogNet v2.
DOGAGE_STAGES = [("cachorro", 0.0, 24.0), ("adulto", 24.0, 72.0), ("senior", 72.0, 1e9)]


class AgeHead(nn.Module):
    """Distribucion de la edad sobre los rangos de AGE_EDGES (devuelve logits).

    Se entrena con intervalos de edad (experiments/train_age.py): la perdida es
    -log P(edad dentro del intervalo de la etiqueta).
    """

    def __init__(self, n_bins: int = len(AGE_EDGES) - 1, hidden: int = 256, dropout: float = 0.3) -> None:
        super().__init__()
        self.net = nn.Sequential(nn.Dropout(0.1), nn.Linear(EMBED_DIM, hidden), nn.GELU(),
                                 nn.Dropout(dropout), nn.Linear(hidden, n_bins))

    def forward(self, feat: torch.Tensor) -> torch.Tensor:
        return self.net(feat)


class AgeNet(nn.Module):
    """Estimador de edad v3: EfficientNetB0 propio afinado de punta a punta para la edad
    (experiments/train_age_e2e.py), con AgeHead encima.

    La version anterior entrenaba solo AgeHead sobre el vector de DogNet v2 congelado;
    ese vector se aprendio para distinguir RAZAS (y por eso ignora a proposito si el
    perro es joven o viejo): muchos cachorros de 5-12 meses salian "adultos"."""

    def __init__(self, n_bins: int = len(AGE_EDGES) - 1, hidden: int = 256) -> None:
        super().__init__()
        base = efficientnet_b0(weights=None)
        self.features = base.features
        self.avgpool = base.avgpool
        self.head = AgeHead(n_bins=n_bins, hidden=hidden)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(torch.flatten(self.avgpool(self.features(x)), 1))


def combine_with_stage(p_bins: torch.Tensor, p_stage: torch.Tensor, alpha: float,
                       edges=AGE_EDGES) -> torch.Tensor:
    """Producto de expertos con la cabeza age_head de DogNet (cachorro/adulto/senior):
    P(rango) * P(etapa del rango)^alpha, renormalizado. age_head distingue mejor a los
    seniors; AgeHead aporta los meses de cachorro. p_bins [N, K], p_stage [N, 3]."""
    if alpha <= 0:
        return p_bins
    stage = torch.tensor([next(i for i, st in enumerate(DOGAGE_STAGES) if edges[k + 1] <= st[2])
                          for k in range(len(edges) - 1)], device=p_bins.device)
    q = p_bins * p_stage[:, stage] ** alpha
    return q / q.sum(1, keepdim=True)


def age_quantile(p, q: float, edges=AGE_EDGES) -> float:
    """Cuantil q (meses) de la distribucion por rangos, interpolando en escala log."""
    cum = 0.0
    for k, pk in enumerate(p):
        if pk <= 0:
            continue
        if cum + pk >= q:
            lo, hi = max(edges[k], 0.5), edges[k + 1]
            return math.exp(math.log(lo) + (q - cum) / pk * (math.log(hi) - math.log(lo)))
        cum += pk
    return edges[-1]


def months_text(m: float) -> str:
    """1.2 -> '1 mes', 3.2 -> '3 meses', 14 -> '1 año', 20 -> '1 año y medio', 50 -> '4 años'."""
    if m < 1.5:
        return "1 mes"
    if m < 11.5:
        return f"{round(m)} meses"
    if m < 18:
        return "1 año"
    if m < 24:
        return "1 año y medio"
    return f"{round(m / 12)} años"


def range_text(lo: float, hi: float) -> str:
    senior = STAGES[2][1]
    if lo >= senior:
        return "6 años o más"
    if hi >= senior:
        return f"de {months_text(lo)} en adelante"
    if hi < 11.5:
        a, b = round(lo), max(round(hi), round(lo) + 1)
        return f"menos de {b} meses" if lo < 1 else f"entre {a} y {b} meses"
    if lo >= 24:
        a = round(lo / 12)
        return f"entre {a} y {max(round(hi / 12), a + 1)} años"
    return f"entre {months_text(lo)} y {months_text(hi)}"


def age_estimate(p, q_range=(0.2, 0.8), edges=AGE_EDGES) -> dict:
    """Edad legible a partir de las probabilidades por rango de AgeHead.

    months = mediana; rango = cuantiles q_range. stage (cachorro/adulto/senior) sale
    de la mediana para que sea coherente con el texto, y stage_confidence es la
    probabilidad de esa etapa. puppy_probability = P(menos de 1 anio).
    """
    p = [float(x) for x in p]
    puppy = sum(pk for k, pk in enumerate(p) if edges[k + 1] <= PUPPY_MAX_MONTHS)
    m = age_quantile(p, 0.5, edges)
    lo, hi = age_quantile(p, q_range[0], edges), age_quantile(p, q_range[1], edges)
    stage, a, b = next(st for st in STAGES if st[1] <= m < st[2])
    conf = sum(pk for k, pk in enumerate(p) if a <= edges[k] and edges[k + 1] <= b)
    return {"months": round(m, 1), "min_months": round(lo, 1), "max_months": round(hi, 1),
            "text": "más de 6 años" if m >= STAGES[2][1] else months_text(m),
            "range_text": range_text(lo, hi), "puppy_probability": round(puppy, 4),
            "stage": stage, "stage_confidence": round(conf, 4)}
