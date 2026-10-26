"""Modelos de vision del ml-service.

Arquitectura HIBRIDA (medida y elegida, ver experiments/measure_finetuned.py):
- EfficientNetEmbedder: EfficientNetB0 CRUDO (ImageNet) -> embedding de 1280-d para
  la similitud INDIVIDUAL (mejor separacion entre perros de la misma raza).
- BreedClassifier: EfficientNetB0 FINE-TUNED en 20 razas de Mexico (mx20) + prototipos
  -> clasifica la RAZA (filtro), por cercania de coseno a los prototipos.

El fine-tuned NO se usa como embedding porque colapsa la identidad individual
(agrupa por raza). Se usa solo como compuerta de raza.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import List

import torch
import torch.nn as nn
from PIL import Image
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0
from torchvision.models.detection import (
    SSDLite320_MobileNet_V3_Large_Weights, ssdlite320_mobilenet_v3_large)

MODEL_NAME = "efficientnet_b0"
BREED_MODEL_NAME = "efficientnet_b0_mx20"
COCO_DOG_LABEL = 18


def resolve_device(device: str) -> torch.device:
    if device in ("auto", "cuda") and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


class DogCropper:
    """Detecta y recorta al perro de la imagen (SSDLite/COCO) para quitar el fondo
    antes de generar el embedding/clasificar. Si no detecta perro, devuelve la
    imagen original. Solo inferencia; pesos de torchvision (no HuggingFace).
    """

    def __init__(self, device: str = "auto", min_score: float = 0.3, pad: float = 0.08) -> None:
        self.device = resolve_device(device)
        self.min_score = min_score
        self.pad = pad
        weights = SSDLite320_MobileNet_V3_Large_Weights.DEFAULT
        self.preprocess = weights.transforms()
        model = ssdlite320_mobilenet_v3_large(weights=weights)
        model.eval()
        self.model = model.to(self.device)

    @torch.inference_mode()
    def crop(self, img: Image.Image) -> Image.Image:
        try:
            tensor = self.preprocess(img).to(self.device)
            out = self.model([tensor])[0]
            best, area = None, 0.0
            for box, label, score in zip(out["boxes"], out["labels"], out["scores"]):
                if int(label) == COCO_DOG_LABEL and float(score) >= self.min_score:
                    x1, y1, x2, y2 = [float(v) for v in box]
                    a = (x2 - x1) * (y2 - y1)
                    if a > area:
                        area, best = a, (x1, y1, x2, y2)
            if best is None:
                return img
            x1, y1, x2, y2 = best
            px, py = (x2 - x1) * self.pad, (y2 - y1) * self.pad
            w, h = img.size
            return img.crop((max(0, x1 - px), max(0, y1 - py),
                             min(w, x2 + px), min(h, y2 + py)))
        except Exception:
            return img


def load_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        return image.convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"No se pudo decodificar la imagen: {exc}") from exc


def _bare_backbone():
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    model.classifier = nn.Identity()  # salida = 1280 (global avg pool)
    return model


# Rangos de clases ImageNet: 151..268 = razas de perro domestico;
# 269..280 = canidos salvajes (lobos, coyote, dingo, dhole, licaon, hiena, zorros).
IMAGENET_DOG_RANGE = (151, 269)
IMAGENET_WILD_RANGE = (269, 281)
IMAGENET_TEDDY = 850  # "teddy, teddy bear" (peluches)


class EfficientNetEmbedder:
    """EfficientNetB0 crudo: embeddings individuales + compuerta de animal.

    Conserva la cabeza clasificadora de ImageNet para detectar si la imagen es
    un perro domestico, un canido salvaje (lobo/coyote/zorro) u otra cosa —
    sin entrenamiento adicional.
    """

    def __init__(self, device: str = "auto", l2_normalize: bool = True,
                 cropper: "DogCropper | None" = None) -> None:
        self.device = resolve_device(device)
        self.l2_normalize = l2_normalize
        self.cropper = cropper
        weights = EfficientNet_B0_Weights.IMAGENET1K_V1
        self.preprocess = weights.transforms()
        model = efficientnet_b0(weights=weights)  # con cabeza ImageNet
        model.eval()
        self.model = model.to(self.device)
        self.embedding_dim = 1280

    @torch.inference_mode()
    def _forward(self, images: List[Image.Image]):
        """Un solo pase: devuelve (embeddings normalizados, gates de animal)."""
        if self.cropper is not None:
            images = [self.cropper.crop(img) for img in images]
        batch = torch.stack([self.preprocess(img) for img in images]).to(self.device)
        feats = self.model.features(batch)
        feats = self.model.avgpool(feats)
        feats = torch.flatten(feats, 1)                 # [N, 1280]
        logits = self.model.classifier(feats)           # [N, 1000] ImageNet
        probs = torch.softmax(logits, dim=1)

        p_dog = probs[:, IMAGENET_DOG_RANGE[0]:IMAGENET_DOG_RANGE[1]].sum(1)
        p_wild = probs[:, IMAGENET_WILD_RANGE[0]:IMAGENET_WILD_RANGE[1]].sum(1)
        p_teddy = probs[:, IMAGENET_TEDDY]

        vectors = feats
        if self.l2_normalize:
            vectors = torch.nn.functional.normalize(vectors, p=2, dim=1)

        gates = []
        for i in range(len(images)):
            d, w = float(p_dog[i]), float(p_wild[i])
            o = max(0.0, 1.0 - d - w)
            animal = "dog" if d >= max(w, o) else ("wild_canid" if w >= o else "other")
            gates.append({"animal": animal, "is_dog": animal == "dog",
                          "dog_score": round(d, 4), "wild_score": round(w, 4),
                          "teddy_score": round(float(p_teddy[i]), 4)})
        return vectors.cpu().tolist(), gates

    @torch.inference_mode()
    def embed(self, images: List[Image.Image]) -> List[List[float]]:
        if not images:
            return []
        vectors, _ = self._forward(images)
        return vectors

    def embed_bytes(self, raw_images: List[bytes]) -> List[List[float]]:
        return self.embed([load_image(d) for d in raw_images])

    def analyze_bytes(self, raw_images: List[bytes]):
        """Embeddings + compuerta de animal en una sola pasada."""
        return self.analyze_images([load_image(d) for d in raw_images])

    def analyze_images(self, images: List[Image.Image]):
        if not images:
            return [], []
        return self._forward(images)


class BreedClassifier:
    """EfficientNetB0 fine-tuned (mx20) + prototipos -> clasificacion de raza."""

    def __init__(self, weights_path: Path, prototypes_path: Path,
                 device: str = "auto", temperature: float = 0.1,
                 cropper: "DogCropper | None" = None) -> None:
        self.device = resolve_device(device)
        self.temperature = temperature
        self.cropper = cropper
        weights = EfficientNet_B0_Weights.IMAGENET1K_V1
        self.preprocess = weights.transforms()

        model = _bare_backbone()
        model.load_state_dict(torch.load(weights_path, map_location=self.device, weights_only=True))
        model.eval()
        self.model = model.to(self.device)

        data = torch.load(prototypes_path, map_location=self.device, weights_only=True)
        self.classes: List[str] = data["classes"]
        protos = data["prototypes"].to(self.device).float()
        self.prototypes = torch.nn.functional.normalize(protos, p=2, dim=1)  # [20, 1280]

    @torch.inference_mode()
    def classify(self, images: List[Image.Image], top_k: int = 3) -> List[dict]:
        if not images:
            return []
        if self.cropper is not None:
            images = [self.cropper.crop(img) for img in images]
        batch = torch.stack([self.preprocess(img) for img in images]).to(self.device)
        feat = torch.nn.functional.normalize(self.model(batch), p=2, dim=1)
        sims = feat @ self.prototypes.T  # [N, 20] coseno
        probs = torch.softmax(sims / self.temperature, dim=1)

        results = []
        for i in range(len(images)):
            top = torch.topk(probs[i], min(top_k, len(self.classes)))
            results.append({
                "breed": self.classes[int(top.indices[0])],
                "confidence": round(float(top.values[0]), 4),
                "top": [
                    {"breed": self.classes[int(idx)], "score": round(float(probs[i][idx]), 4)}
                    for idx in top.indices
                ],
            })
        return results

    def classify_bytes(self, raw_images: List[bytes], top_k: int = 3) -> List[dict]:
        return self.classify([load_image(d) for d in raw_images], top_k)
