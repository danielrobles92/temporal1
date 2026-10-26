"""Compara la discriminacion individual CON vs SIN recorte del perro, sobre el
mismo proxy honesto: positivo = misma imagen aumentada (mismo perro), negativo =
otra imagen de la misma raza (otro perro). Reporta el margen (positivo - negativo);
mayor margen = mejor para distinguir al MISMO perro.
"""
import random
import sys
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image, ImageEnhance
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.model import DogCropper  # noqa: E402

import json  # noqa: E402

random.seed(5)
torch.manual_seed(5)
DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")
ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "experiments" / "mx_breeds.json").read_text(encoding="utf-8"))
DATA = (ROOT / "experiments" / CFG["dataset_root"]).resolve()

TF = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def augment(img):
    out = img.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = out.size
    dx, dy = int(w * 0.08), int(h * 0.08)
    out = out.crop((dx, dy, w - dx, h - dy)).resize((w, h)).rotate(10)
    return ImageEnhance.Brightness(out).enhance(1.18)


def backbone():
    m = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    m.classifier = nn.Identity()
    return m.eval().to(DEV)


@torch.inference_mode()
def embed(model, img, cropper=None):
    if cropper is not None:
        img = cropper.crop(img)
    x = TF(img).unsqueeze(0).to(DEV)
    return torch.nn.functional.normalize(model(x), p=2, dim=1).squeeze(0)


def run(model, cropper, label):
    breeds = random.sample(CFG["breeds"], 12)
    pos, neg = [], []
    for b in breeds:
        paths = sorted((DATA / b["folder"]).glob("*.jpg"))[:10]
        imgs = [Image.open(p).convert("RGB") for p in paths]
        embs = [embed(model, im, cropper) for im in imgs]
        for i in range(len(imgs)):
            pos.append(float(torch.dot(embs[i], embed(model, augment(imgs[i]), cropper))))
            j = (i + 3) % len(imgs)
            if j != i:
                neg.append(float(torch.dot(embs[i], embs[j])))
    mp = sum(pos) / len(pos)
    mn = sum(neg) / len(neg)
    print(f"{label:20s} | mismo={mp:.3f}  impostor-raza={mn:.3f}  MARGEN={mp-mn:+.3f}")


if __name__ == "__main__":
    model = backbone()
    print("Cargando detector (descarga pesos la 1a vez)...")
    cropper = DogCropper(device="auto")
    run(model, None, "SIN recorte")
    run(model, cropper, "CON recorte")
