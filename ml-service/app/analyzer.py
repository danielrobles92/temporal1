"""DogAnalyzer: describe al perro de una foto con DogNet v2.

Para cada imagen decide:
  1. si ES un perro (si no: gato / peluche / otro animal / objeto y un mensaje),
  2. la raza entre las 20 del catalogo o "Otro" (otra raza o mestizo),
  3. tamano (+ rango de peso orientativo) y etapa: cachorro (< 1 anio) o adulto,
  4. color del pelaje (segmentacion + k-means, ver color.py).

Los umbrales se calibran con experiments/eval_v2.py y se guardan en
models/dognet_v2_thresholds.json; si no existe se usan valores por defecto.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Optional

import torch
from PIL import Image
from torchvision.models import EfficientNet_B0_Weights

from .color import DogSegmenter, coat_colors
from .dognet import AgeNet, DogNetV2

log = logging.getLogger(__name__)

ANIMAL_CODE = {"gato": "cat", "peluche": "plush", "animal": "animal", "objeto": "object"}
NOT_DOG_TEXT = {
    "gato": "parece un gato",
    "peluche": "parece un peluche o juguete",
    "animal": "parece otro animal",
    "objeto": "no se detecta ningun perro",
}
DEFAULT_THRESHOLDS = {"not_dog": 0.5, "breed_min": 0.4, "teddy_imagenet": 0.5, "wild_imagenet": 1.01,
                      "rescue_imagenet": 0.7, "rescue_max_not_dog": 0.8}


class DogAnalyzer:
    def __init__(self, weights_path: Path, device: torch.device,
                 thresholds_path: Optional[Path] = None, with_color: bool = True,
                 age_path: Optional[Path] = None, with_age: bool = True) -> None:
        self.device = device
        ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)
        self.meta = ckpt["meta"]
        self.classes: List[str] = self.meta["classes"]
        self.breeds: List[str] = self.meta["breeds"]
        self.i_otro: int = self.meta["otro_index"]
        self.i_nd: int = self.meta["not_dog_index"]
        self.not_dog_types: List[str] = self.meta["not_dog_types"]
        self.sizes: List[str] = self.meta["sizes"]
        self.ages: List[str] = self.meta["ages"]

        model = DogNetV2(len(self.classes), len(self.sizes), len(self.ages), pretrained=False)
        model.load_state_dict(ckpt["state_dict"])
        self.model = model.eval().to(device)
        self.preprocess = EfficientNet_B0_Weights.IMAGENET1K_V1.transforms()

        # Etapa de vida: red EfficientNetB0 propia (experiments/train_puppy.py) con dos
        # salidas, cachorro (< 12.5 meses) y adulto. La cabeza age_head de DogNet v2 (etapas
        # de DogAge, joven = 0-2 anios) ya no se usa: confundia cachorros con adultos.
        self.puppy_net, self.age_meta = None, None
        if with_age and age_path is not None and age_path.exists():
            age_ckpt = torch.load(age_path, map_location="cpu", weights_only=True)
            if age_ckpt["meta"].get("kind") != "binary":
                log.warning("%s no es un modelo cachorro/adulto: se ignora", age_path.name)
            else:
                self.age_meta = age_ckpt["meta"]
                net = AgeNet(n_bins=2, hidden=self.age_meta["hidden"])
                net.load_state_dict(age_ckpt["state_dict"])
                self.puppy_net = net.eval().to(device)
        self.puppy_threshold = (self.age_meta or {}).get("threshold", 0.5)

        self.thresholds = dict(DEFAULT_THRESHOLDS)
        if thresholds_path is not None and thresholds_path.exists():
            self.thresholds.update(json.loads(thresholds_path.read_text(encoding="utf-8")))
        self.segmenter = None
        if with_color:
            try:
                self.segmenter = DogSegmenter(device)
            except Exception as exc:  # noqa: BLE001 - sin pesos de segmentacion: sin color
                log.warning("Segmentador no disponible, no se estimara el color: %s", exc)

    @torch.inference_mode()
    def describe(self, images: List[Image.Image], gates: Optional[List[dict]] = None) -> List[dict]:
        """gates: compuerta ImageNet del embedder crudo (opcional, segunda opinion)."""
        if not images:
            return []
        batch = torch.stack([self.preprocess(img) for img in images]).to(self.device)
        # Promedio con la imagen en espejo (TTA): +0.3 pts en raza y "Otro" y menos
        # perros rechazados por error en la validacion (experiments/eval_v2.py).
        n = len(images)
        feat = self.model.embed(torch.cat([batch, torch.flip(batch, dims=[3])]))
        logits, size_logits, _ = self.model.heads(feat)      # age_head (DogAge) ya no se usa

        def avg(lg):
            p = torch.softmax(lg.float(), 1)
            return ((p[:n] + p[n:]) / 2).cpu()

        probs, size_p = avg(logits), avg(size_logits)
        p_puppy = [None] * n
        if self.puppy_net is not None:                          # mismo TTA (foto + espejo)
            p_puppy = avg(self.puppy_net(torch.cat([batch, torch.flip(batch, dims=[3])])))[:, 0].tolist()
        segs = self.segmenter.masks(images) if self.segmenter is not None else [None] * len(images)

        out = []
        for i in range(len(images)):
            gate = (gates[i] if gates else None) or {}
            res = self._describe_one(probs[i], size_p[i], segs[i], gate)
            if res["is_dog"] and p_puppy[i] is not None:
                puppy = p_puppy[i] >= self.puppy_threshold
                res["age"] = "cachorro" if puppy else "adulto"
                res["age_confidence"] = round(p_puppy[i] if puppy else 1.0 - p_puppy[i], 4)
                res["puppy_probability"] = round(p_puppy[i], 4)
            out.append(res)
        return out

    def _describe_one(self, p, size_p, seg, gate) -> dict:
        t = self.thresholds
        p_nd = p[self.i_nd:]
        p_not_dog = float(p_nd.sum())
        nd_type = self.not_dog_types[int(p_nd.argmax())]

        is_dog = p_not_dog < t["not_dog"]
        # Rescate: la cabeza ImageNet esta segura de que es un perro (y no un peluche),
        # p. ej. cachorros de pelo esponjado que DogNet confunde con peluche.
        if (not is_dog and gate.get("dog_score", 0.0) >= t["rescue_imagenet"]
                and gate.get("teddy_score", 0.0) < min(t["teddy_imagenet"], 0.5)
                and p_not_dog < t["rescue_max_not_dog"]):
            is_dog = True
        # Segunda opinion de la cabeza ImageNet: peluches y canidos salvajes.
        if is_dog and gate.get("teddy_score", 0.0) >= t["teddy_imagenet"]:
            is_dog, nd_type = False, "peluche"
        if is_dog and gate.get("wild_score", 0.0) >= t["wild_imagenet"]:
            is_dog, nd_type = False, "animal"

        res = {"is_dog": is_dog, "dog_probability": round(1.0 - p_not_dog, 4),
               "animal": "dog" if is_dog else ANIMAL_CODE[nd_type],
               "not_dog_type": None if is_dog else nd_type, "message": None,
               "breed": None, "breed_confidence": 0.0, "in_catalog": False, "breed_top": [],
               "size": None, "size_confidence": None, "weight_kg": None,
               "age": None, "age_confidence": None, "puppy_probability": None,
               "color": None, "color_secondary": None, "color_label": None, "colors": []}
        if not is_dog:
            res["message"] = (f"La imagen no se identifica como un perro ({NOT_DOG_TEXT[nd_type]}). "
                              "No se puede procesar.")
            return res

        dog_p = p[: self.i_otro + 1]
        dog_p = dog_p / dog_p.sum()                       # P(clase | es perro)
        top = torch.topk(dog_p[: self.i_otro], 3)          # top-3 de las 20 razas
        res["breed_top"] = [{"breed": self.breeds[int(j)], "score": round(float(dog_p[j]), 4)}
                            for j in top.indices]
        best = int(dog_p.argmax())
        if best != self.i_otro and float(dog_p[best]) >= t["breed_min"]:
            res.update(breed=self.breeds[best], breed_confidence=round(float(dog_p[best]), 4),
                       in_catalog=True)
        else:
            res.update(breed="Otro", breed_confidence=round(float(dog_p[self.i_otro]), 4),
                       in_catalog=False,
                       message="Perro de una raza fuera del catalogo o mestizo (Otro).")

        si = int(size_p.argmax())
        res["size"], res["size_confidence"] = self.sizes[si], round(float(size_p[si]), 4)
        lo, hi = self.meta["size_weight_kg"][self.sizes[si]]
        res["weight_kg"] = {"min": lo, "max": hi}
        if seg is not None:
            small, mask, _ = seg
            res.update(coat_colors(small, mask))
        return res
