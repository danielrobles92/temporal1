"""Calibracion: convierte la similitud del coseno (embedding crudo) en una
probabilidad P(mismo perro), ajustando una regresion logistica sobre dos
distribuciones medidas en el dataset:

  POSITIVO ("mismo perro, otra foto"): cosine(img, aumentada(img))  [proxy]
  NEGATIVO ("otro perro, MISMA raza"): cosine(img_a, img_b) distintos de la raza

El resultado P = sigmoid(w*cos + b) se usa en el backend para mostrar un % con
significado DESPUES del filtro de raza (la calibracion es dentro de la misma raza).
"""
import json
import random
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image, ImageEnhance
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

random.seed(11)
torch.manual_seed(11)
DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")
ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "experiments" / "mx_breeds.json").read_text(encoding="utf-8"))
DATA = (ROOT / "experiments" / CFG["dataset_root"]).resolve()

EVAL_TF = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def augment(img):
    out = img.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = out.size
    dx, dy = int(w * 0.08), int(h * 0.08)
    out = out.crop((dx, dy, w - dx, h - dy)).resize((w, h)).rotate(10)
    return ImageEnhance.Brightness(out).enhance(1.18)


def raw_backbone():
    m = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    m.classifier = nn.Identity()
    return m.eval().to(DEV)


@torch.inference_mode()
def embed(model, img):
    x = EVAL_TF(img).unsqueeze(0).to(DEV)
    return torch.nn.functional.normalize(model(x), p=2, dim=1).squeeze(0)


def main():
    model = raw_backbone()
    breeds = random.sample(CFG["breeds"], 16)
    pos, neg = [], []

    for b in breeds:
        paths = sorted((DATA / b["folder"]).glob("*.jpg"))[:14]
        imgs = [Image.open(p).convert("RGB") for p in paths]
        embs = [embed(model, im) for im in imgs]
        for i in range(len(imgs)):
            # positivo: misma imagen aumentada
            pos.append(float(torch.dot(embs[i], embed(model, augment(imgs[i])))))
            # negativo: otra imagen de la misma raza (otro perro)
            j = (i + 3) % len(imgs)
            if j != i:
                neg.append(float(torch.dot(embs[i], embs[j])))

    pos_t = torch.tensor(pos)
    neg_t = torch.tensor(neg)
    print(f"positivos n={len(pos)}  media={pos_t.mean():.3f}  std={pos_t.std():.3f}")
    print(f"negativos n={len(neg)}  media={neg_t.mean():.3f}  std={neg_t.std():.3f}")

    # Ajuste de regresion logistica: P(mismo) = sigmoid(w*cos + b)
    x = torch.cat([pos_t, neg_t]).unsqueeze(1)
    y = torch.cat([torch.ones(len(pos)), torch.zeros(len(neg))]).unsqueeze(1)
    w = torch.zeros(1, 1, requires_grad=True)
    b = torch.zeros(1, requires_grad=True)
    opt = torch.optim.Adam([w, b], lr=0.05)
    lossf = nn.BCEWithLogitsLoss()
    for _ in range(3000):
        opt.zero_grad()
        loss = lossf(x @ w + b, y)
        loss.backward()
        opt.step()

    W, B = float(w.item()), float(b.item())
    c0 = -B / W  # cosine donde P = 0.5
    print(f"\nP(mismo perro) = sigmoid({W:.3f} * cos + ({B:.3f}))")
    print(f"frontera P=0.5 en cos = {c0:.3f}")
    sig = lambda c: 1 / (1 + pow(2.718281828, -(W * c + B)))
    print("cos -> P:")
    for c in [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]:
        print(f"  {c:.2f} -> {sig(c)*100:5.1f}%")

    # umbral sugerido: cos donde P>=0.7
    thr = (torch.logit(torch.tensor(0.7)).item() - B) / W
    print(f"umbral 'muy probable' (P>=70%): cos >= {thr:.3f}")
    print(f"\nPARA EL BACKEND -> w={W:.4f}  b={B:.4f}")


if __name__ == "__main__":
    main()
