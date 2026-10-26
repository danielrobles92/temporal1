"""Experimento: comparar backbones para identificacion de perro individual.

Como el dataset esta etiquetado por raza (no por individuo), se usa un proxy honesto:
- POSITIVO ("mismo perro, otra foto"): version aumentada de la MISMA imagen
  (flip, recorte, brillo/contraste, rotacion leve) -> simula otra toma del mismo perro.
- NEGATIVO DIFICIL ("otro perro, misma raza"): otra imagen de la misma raza.
- NEGATIVO FACIL ("otro perro, otra raza"): imagen de otra raza.

Un buen extractor para identificar al MISMO perro debe cumplir:
  sim(positivo) >> sim(neg_dificil) > sim(neg_facil)
y rankear el positivo en el puesto #1 frente a una galeria de impostores.

Metricas: top-1 (el positivo es el mas parecido) y margenes de similitud.
"""
import random
from pathlib import Path

import torch
from PIL import Image, ImageEnhance

random.seed(7)
torch.manual_seed(7)
DEVICE = torch.device("cpu")
STANFORD = Path(__file__).resolve().parents[2] / "imagesDS" / "images" / "Images"


# ---------------- aumentacion (simula "otra foto del mismo perro") ----------------
def augment(img: Image.Image) -> Image.Image:
    out = img.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = out.size
    # recorte central al 85% y reescalado
    dx, dy = int(w * 0.075), int(h * 0.075)
    out = out.crop((dx, dy, w - dx, h - dy)).resize((w, h))
    out = out.rotate(8, expand=False)
    out = ImageEnhance.Brightness(out).enhance(1.18)
    out = ImageEnhance.Contrast(out).enhance(0.9)
    return out


# ---------------- backbones ----------------
def build_efficientnet():
    from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0
    w = EfficientNet_B0_Weights.IMAGENET1K_V1
    m = efficientnet_b0(weights=w)
    m.classifier = torch.nn.Identity()
    m.eval().to(DEVICE)
    pre = w.transforms()
    return ("efficientnet_b0", m, pre, None)


def build_dinov2():
    import timm
    m = timm.create_model("vit_small_patch14_dinov2.lvd142m", pretrained=True,
                          num_classes=0, img_size=224)
    m.eval().to(DEVICE)
    cfg = timm.data.resolve_model_data_config(m)
    pre = timm.data.create_transform(**cfg, is_training=False)
    return ("dinov2_vits14", m, pre, None)


def build_dog_cropper():
    from torchvision.models.detection import (
        SSDLite320_MobileNet_V3_Large_Weights, ssdlite320_mobilenet_v3_large)
    w = SSDLite320_MobileNet_V3_Large_Weights.DEFAULT
    det = ssdlite320_mobilenet_v3_large(weights=w)
    det.eval().to(DEVICE)
    prep = w.transforms()

    @torch.inference_mode()
    def crop(img: Image.Image) -> Image.Image:
        t = prep(img).to(DEVICE)
        out = det([t])[0]
        best, area = None, 0
        for box, label, score in zip(out["boxes"], out["labels"], out["scores"]):
            if int(label) == 18 and float(score) > 0.3:  # COCO dog = 18
                x1, y1, x2, y2 = [float(v) for v in box]
                a = (x2 - x1) * (y2 - y1)
                if a > area:
                    area, best = a, (x1, y1, x2, y2)
        if best is None:
            return img
        x1, y1, x2, y2 = best
        return img.crop((max(0, x1), max(0, y1), min(img.width, x2), min(img.height, y2)))

    return crop


@torch.inference_mode()
def embed(model, pre, img, cropper=None):
    if cropper is not None:
        img = cropper(img)
    x = pre(img).unsqueeze(0).to(DEVICE)
    v = model(x)
    v = torch.nn.functional.normalize(v, p=2, dim=1)
    return v.squeeze(0)


def cos(a, b):
    return float(torch.dot(a, b))


# ---------------- muestreo del dataset ----------------
def sample_images(n_breeds=8, per_breed=4):
    breeds = sorted([d for d in STANFORD.iterdir() if d.is_dir()])
    breeds = random.sample(breeds, n_breeds)
    data = {}
    for b in breeds:
        imgs = sorted(b.glob("*.jpg"))[:per_breed]
        data[b.name] = [Image.open(p).convert("RGB") for p in imgs]
    return data


def evaluate(name, model, pre, cropper=None):
    data = sample_images()
    breeds = list(data.keys())
    # galeria: 1ra imagen de cada perro (un "individuo" por raza para el proxy)
    gallery = {b: embed(model, pre, data[b][0], cropper) for b in breeds}

    top1 = 0
    pos_sims, hardneg_sims, easyneg_sims = [], [], []
    for b in breeds:
        q = embed(model, pre, augment(data[b][0]), cropper)  # "otra foto" del perro b
        sims = {bb: cos(q, gallery[bb]) for bb in breeds}
        best = max(sims, key=sims.get)
        if best == b:
            top1 += 1
        pos_sims.append(sims[b])
        # neg dificil: otra imagen de la MISMA raza (otro individuo)
        if len(data[b]) > 1:
            other = embed(model, pre, data[b][1], cropper)
            hardneg_sims.append(cos(q, other))
        # neg facil: mejor impostor de otra raza
        easyneg_sims.append(max(v for bb, v in sims.items() if bb != b))

    m = lambda xs: sum(xs) / len(xs) if xs else float("nan")
    print(f"\n=== {name} ===")
    print(f"  top-1 (positivo es #1):   {top1}/{len(breeds)}")
    print(f"  sim positivo (mismo):     {m(pos_sims):.3f}")
    print(f"  sim neg dificil (=raza):  {m(hardneg_sims):.3f}")
    print(f"  sim neg facil (!=raza):   {m(easyneg_sims):.3f}")
    print(f"  margen (pos - negDif):    {m(pos_sims) - m(hardneg_sims):+.3f}")


if __name__ == "__main__":
    print("Cargando backbones (descarga pesos la 1a vez)...")
    name_e, me, pe, _ = build_efficientnet()
    evaluate("EfficientNetB0 (actual)", me, pe)

    name_d, md, pd, _ = build_dinov2()
    evaluate("DINOv2 ViT-S/14", md, pd)

    cropper = build_dog_cropper()
    evaluate("DINOv2 ViT-S/14 + recorte de perro", md, pd, cropper)
