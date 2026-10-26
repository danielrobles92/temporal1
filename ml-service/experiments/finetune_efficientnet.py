"""Fine-tuning de EfficientNetB0 sobre el dataset de razas (Stanford Dogs) con
cabeza ArcFace, para obtener embeddings de 1280-d discriminativos para perros.

- Backbone: EfficientNetB0 preentrenado en ImageNet (se afina completo).
- Cabeza:   ArcMarginProduct (ArcFace) sobre N razas -> separa angularmente,
            ideal para luego comparar con similitud del coseno.
- Salida:   se guarda SOLO el backbone (state_dict) en models/efficientnet_b0_dogs.pt
            y models/dog_classes.json (mapa indice->raza, para el filtro por raza).

Uso:
  python experiments/finetune_efficientnet.py --epochs 12 --batch 32
  python experiments/finetune_efficientnet.py --epochs 1 --subset 0.1   # smoke test
"""
import argparse
import json
import math
import time
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import transforms
from torchvision.datasets import ImageFolder
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "imagesDS" / "images" / "Images"
OUT_DIR = ROOT / "models"
EMBED_DIM = 1280


class ArcMarginProduct(nn.Module):
    """ArcFace: margen angular aditivo sobre embedding y pesos normalizados."""

    def __init__(self, in_features, out_features, scale=30.0, margin=0.50):
        super().__init__()
        self.weight = nn.Parameter(torch.empty(out_features, in_features))
        nn.init.xavier_uniform_(self.weight)
        self.scale = scale
        self.cos_m = math.cos(margin)
        self.sin_m = math.sin(margin)
        self.th = math.cos(math.pi - margin)
        self.mm = math.sin(math.pi - margin) * margin

    def forward(self, embeddings, labels):
        cosine = F.linear(F.normalize(embeddings), F.normalize(self.weight)).clamp(-1, 1)
        sine = torch.sqrt((1.0 - cosine * cosine).clamp(min=1e-9))
        phi = cosine * self.cos_m - sine * self.sin_m
        phi = torch.where(cosine > self.th, phi, cosine - self.mm)
        one_hot = torch.zeros_like(cosine)
        one_hot.scatter_(1, labels.view(-1, 1), 1.0)
        output = one_hot * phi + (1.0 - one_hot) * cosine
        return output * self.scale

    @torch.no_grad()
    def cosine_logits(self, embeddings):
        return F.linear(F.normalize(embeddings), F.normalize(self.weight))


def build_backbone():
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    model.classifier = nn.Identity()  # salida = 1280 (global avg pool)
    return model


class ListDataset(Dataset):
    """Dataset a partir de una lista de (ruta, etiqueta), con transform propia."""

    def __init__(self, samples, transform):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, i):
        path, label = self.samples[i]
        img = Image.open(path).convert("RGB")
        return self.transform(img), label


def load_curated(breeds_json, train_tf, eval_tf):
    """Construye train/val datasets a partir de un JSON de razas seleccionadas."""
    cfg_path = Path(breeds_json)
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    root = (cfg_path.parent / cfg["dataset_root"]).resolve()
    classes = [b["name_es"] for b in cfg["breeds"]]

    samples = []
    for idx, b in enumerate(cfg["breeds"]):
        folder = root / b["folder"]
        imgs = sorted(folder.glob("*.jpg")) + sorted(folder.glob("*.jpeg")) + sorted(folder.glob("*.png"))
        for p in imgs:
            samples.append((str(p), idx))
    if not samples:
        raise RuntimeError(f"No se encontraron imagenes bajo {root}")

    g = torch.Generator().manual_seed(42)
    perm = torch.randperm(len(samples), generator=g).tolist()
    samples = [samples[i] for i in perm]
    n_val = max(1, int(len(samples) * 0.1))
    val_s, train_s = samples[:n_val], samples[n_val:]
    return ListDataset(train_s, train_tf), ListDataset(val_s, eval_tf), classes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--subset", type=float, default=1.0, help="fraccion del dataset (smoke test)")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--breeds-json", type=str, default=None,
                    help="JSON con razas curadas; si se omite usa todo Stanford Dogs")
    ap.add_argument("--out", type=str, default="efficientnet_b0_dogs",
                    help="nombre base del checkpoint en models/")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device} | data: {DATA}")
    OUT_DIR.mkdir(exist_ok=True)

    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(0.2, 0.2, 0.2, 0.05),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    if args.breeds_json:
        train_ds, val_ds, classes = load_curated(args.breeds_json, train_tf, eval_tf)
        n_classes = len(classes)
        print(f"Clases curadas (razas MX): {n_classes} | imagenes: {len(train_ds) + len(val_ds)}")
    else:
        full = ImageFolder(str(DATA), transform=train_tf)
        classes = full.classes
        n_classes = len(classes)
        print(f"Clases (razas): {n_classes} | imagenes: {len(full)}")
        n_val = max(1, int(len(full) * 0.1))
        n_train = len(full) - n_val
        g = torch.Generator().manual_seed(42)
        train_ds, val_ds = random_split(full, [n_train, n_val], generator=g)
        val_ds.dataset = ImageFolder(str(DATA), transform=eval_tf)  # val sin augment

    if args.subset < 1.0:
        k = max(args.batch, int(len(train_ds) * args.subset))
        train_ds = torch.utils.data.Subset(train_ds, list(range(k)))
        vk = max(args.batch, int(len(val_ds) * args.subset))
        val_ds = torch.utils.data.Subset(val_ds, list(range(vk)))
        print(f"SUBSET: train={len(train_ds)} val={len(val_ds)}")

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True,
                              num_workers=args.workers, pin_memory=True, drop_last=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False,
                            num_workers=args.workers, pin_memory=True)

    backbone = build_backbone().to(device)
    head = ArcMarginProduct(EMBED_DIM, n_classes).to(device)
    opt = torch.optim.AdamW(list(backbone.parameters()) + list(head.parameters()),
                            lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    scaler = torch.amp.GradScaler("cuda")
    ce = nn.CrossEntropyLoss()

    best_acc = 0.0
    for epoch in range(1, args.epochs + 1):
        backbone.train(); head.train()
        t0 = time.time(); running = 0.0; seen = 0
        for x, y in train_loader:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda"):
                feat = backbone(x)
                logits = head(feat, y)
                loss = ce(logits, y)
            scaler.scale(loss).backward()
            scaler.step(opt); scaler.update()
            running += loss.item() * x.size(0); seen += x.size(0)
        sched.step()

        # validacion: top-1 por logits coseno (sin margen)
        backbone.eval(); head.eval()
        correct = total = 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
                with torch.amp.autocast("cuda"):
                    feat = backbone(x)
                    pred = head.cosine_logits(feat).argmax(1)
                correct += (pred == y).sum().item(); total += y.size(0)
        acc = correct / max(1, total)
        print(f"epoch {epoch:2d}/{args.epochs} | loss {running/max(1,seen):.4f} "
              f"| val_acc {acc:.3f} | lr {sched.get_last_lr()[0]:.2e} | {time.time()-t0:.0f}s",
              flush=True)

        if acc >= best_acc:
            best_acc = acc
            torch.save(backbone.state_dict(), OUT_DIR / f"{args.out}.pt")
            with open(OUT_DIR / f"{args.out}_classes.json", "w", encoding="utf-8") as f:
                json.dump({"classes": classes, "embed_dim": EMBED_DIM,
                           "val_acc": best_acc}, f, ensure_ascii=False, indent=2)

    print(f"LISTO. mejor val_acc={best_acc:.3f} -> {OUT_DIR/(args.out + '.pt')}", flush=True)


if __name__ == "__main__":
    main()
