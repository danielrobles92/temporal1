"""Color aproximado del pelaje a partir de los pixeles del perro.

1. DogSegmenter (DeepLabV3-MobileNetV3, pesos de torchvision, sin entrenamiento)
   separa al perro del fondo (clase VOC "dog"; si no la encuentra usa cualquier
   animal y, en ultimo caso, la zona central de la foto).
2. coat_colors() agrupa los pixeles del perro con k-means y nombra cada grupo con
   la paleta del front (DOG_COLORS): Negro, Blanco, Cafe, Dorado, Gris, Crema.

Es una estimacion: sombras, iluminacion y filtros de la foto la afectan.
"""
from __future__ import annotations

import colorsys
from typing import List, Optional

import numpy as np
import torch
from PIL import Image, ImageFilter
from torchvision.models.segmentation import (DeepLabV3_MobileNet_V3_Large_Weights,
                                             deeplabv3_mobilenet_v3_large)

VOC_DOG = 12
VOC_ANIMALS = (3, 8, 10, 12, 13, 17)   # bird, cat, cow, dog, horse, sheep
_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
SEG_SIDE = 320


class DogSegmenter:
    def __init__(self, device: torch.device) -> None:
        self.device = device
        weights = DeepLabV3_MobileNet_V3_Large_Weights.COCO_WITH_VOC_LABELS_V1
        self.model = deeplabv3_mobilenet_v3_large(weights=weights).eval().to(device)

    @staticmethod
    def _resize(img: Image.Image) -> Image.Image:
        w, h = img.size
        s = SEG_SIDE / max(w, h)
        return img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BILINEAR)

    @torch.inference_mode()
    def masks(self, images: List[Image.Image]):
        """Devuelve [(imagen_reducida, mascara_bool, fraccion_perro)] por imagen."""
        out = []
        for img in images:
            small = self._resize(img)
            x = torch.from_numpy(np.asarray(small, dtype=np.float32) / 255.0).permute(2, 0, 1)
            x = ((x - _MEAN) / _STD).unsqueeze(0).to(self.device)
            labels = self.model(x)["out"].argmax(1)[0].cpu().numpy()
            dog = labels == VOC_DOG
            dog_frac = float(dog.mean())
            mask = dog if dog.sum() >= 200 else np.isin(labels, VOC_ANIMALS)
            if mask.sum() < 200:
                mask = _center_mask(labels.shape)
            out.append((small, _erode(mask), dog_frac))
        return out


def _center_mask(shape):
    h, w = shape
    m = np.zeros(shape, dtype=bool)
    m[h // 5: h - h // 5, w // 5: w - w // 5] = True
    return m


def _erode(mask: np.ndarray) -> np.ndarray:
    """Quita el borde de la mascara (evita mezclar el fondo)."""
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))
    eroded = np.asarray(img) > 127
    return eroded if eroded.sum() >= 100 else mask


def _name(rgb) -> Optional[str]:
    r, g, b = (float(c) / 255.0 for c in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    hue = h * 360
    if v < 0.22:
        return "Negro"
    if s < 0.14:
        if v > 0.72:
            return "Blanco"
        return "Negro" if v < 0.32 else "Gris"
    warm = hue < 55 or hue >= 330
    if not warm:
        return "Gris" if s < 0.30 else None   # tonos frios saturados = fondo
    if v < 0.42:
        return "Cafe"
    if s < 0.32 and v > 0.68:
        return "Crema" if s >= 0.18 else "Blanco"
    if s >= 0.42 and v >= 0.55:
        return "Dorado"
    return "Crema" if v >= 0.66 else "Cafe"


def _kmeans(pixels: np.ndarray, k: int = 4, iters: int = 12, seed: int = 0):
    rng = np.random.default_rng(seed)
    centers = pixels[rng.choice(len(pixels), size=k, replace=False)].astype(np.float32)
    for _ in range(iters):
        d = ((pixels[:, None, :] - centers[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        for j in range(k):
            sel = pixels[lab == j]
            if len(sel):
                centers[j] = sel.mean(0)
    return centers, np.bincount(lab, minlength=k)


def coat_colors(small: Image.Image, mask: np.ndarray) -> dict:
    pixels = np.asarray(small, dtype=np.float32)[mask]
    if len(pixels) > 4000:
        pixels = pixels[np.random.default_rng(0).choice(len(pixels), 4000, replace=False)]
    if len(pixels) < 50:
        return {"color": None, "color_secondary": None, "color_label": None, "colors": []}
    centers, counts = _kmeans(pixels, k=min(4, len(pixels)))
    shares: dict = {}
    for c, n in zip(centers, counts):
        name = _name(c)
        if name and n:
            shares[name] = shares.get(name, 0) + int(n)
    total = sum(shares.values()) or 1
    ranked = sorted(((k, v / total) for k, v in shares.items()), key=lambda kv: -kv[1])
    main = ranked[0][0] if ranked else None
    second = ranked[1][0] if len(ranked) > 1 and ranked[1][1] >= 0.2 else None
    # >= 20% cada uno: con menos, sombras (negro) y brillos (blanco) daban "Tricolor" falsos
    # (medido sobre R3P0: 72% de color principal plausible por raza vs 69% con 12%).
    notable = {k for k, v in ranked if v >= 0.2}
    tricolor = {"Negro", "Blanco"} <= notable and bool(notable & {"Cafe", "Dorado", "Crema"})
    return {
        "color": main,
        "color_secondary": second,
        "color_label": "Tricolor" if tricolor else main,
        "colors": [{"name": k, "share": round(v, 3)} for k, v in ranked],
    }
