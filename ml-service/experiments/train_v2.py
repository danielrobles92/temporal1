"""Entrena DogNet v2 (EfficientNetB0 multitarea) con los manifiestos de prepare_v2.py.

Tareas (un solo backbone, perdidas enmascaradas segun la etiqueta disponible):
  - clase   : 20 razas + Otro + 4 tipos de no-perro (CE con label smoothing).
              Para fotos de DogAge (perro de raza desconocida) solo se exige
              "es perro": -log P(clases 0..20).
  - tamano  : pequeno/mediano/grande (etiqueta derivada de la raza).
  - edad    : cachorro/adulto/senior (solo DogAge).

Cada epoca se muestrea con reemplazo para balancear: ~300 fotos por raza, y
cuotas fijas para Otro, cada tipo de no-perro y cada grupo de edad.

Uso:
  python experiments/train_v2.py --epochs 14                  # con validacion
  python experiments/train_v2.py --epochs 14 --all-data       # final (train+val)
"""
import argparse
import csv
import json
import math
import sys
import time
from collections import Counter
from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import transforms
from torchvision.transforms import InterpolationMode

import v2_meta as M

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.dognet import DogNetV2  # noqa: E402

CACHE = ROOT.parent / "imagesDS" / "_v2cache"
OUT_DIR = ROOT / "models"
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]

# Cuotas por epoca (muestras). Las razas: PER_BREED cada una.
PER_BREED = 300
QUOTA = {"otro": 2400, "np_gato": 800, "np_peluche": 700, "np_animal": 900,
         "np_objeto": 900, "age0": 1000, "age1": 1000, "age2": 1000,
         "age_expert": 500}   # DogAge Expert (edad verificada): solo en el modelo final


def load_rows(split):
    rows = []
    for f in sorted(CACHE.glob("manifest_*.csv")):
        with open(f, encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                if split == "all" or r["split"] == split:
                    rows.append({"path": r["path"], "source": r["source"], "cls": int(r["cls"]),
                                 "size": int(r["size"]), "age": int(r["age"])})
    return rows


def bucket(r):
    c = r["cls"]
    if 0 <= c < M.IDX_OTRO:
        return f"breed{c}"
    if c == M.IDX_OTRO:
        return "otro"
    if c >= M.IDX_NOT_DOG:
        return "np_" + M.NOT_DOG[c - M.IDX_NOT_DOG]
    if "/expert/" in r["path"]:
        return "age_expert"
    return f"age{r['age']}"


class ManifestDataset(Dataset):
    def __init__(self, rows, tf):
        self.rows, self.tf = rows, tf

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        img = Image.open(CACHE / r["path"]).convert("RGB")
        return self.tf(img), r["cls"], r["size"], r["age"]


def make_sampler(rows):
    counts = Counter(bucket(r) for r in rows)
    target = {b: (PER_BREED if b.startswith("breed") else QUOTA[b]) for b in counts}
    weights = [target[bucket(r)] / counts[bucket(r)] for r in rows]
    n = sum(target.values())
    print("Buckets:", {b: f"{counts[b]}->{target[b]}" for b in sorted(counts)})
    return WeightedRandomSampler(weights, num_samples=n, replacement=True), n


def multitask_loss(logits, size_logits, age_logits, cls, size, age):
    losses = {}
    has_cls = cls >= 0
    if has_cls.any():
        losses["cls"] = F.cross_entropy(logits[has_cls], cls[has_cls], label_smoothing=0.1)
    dog_unknown = cls == -1
    if dog_unknown.any():
        lg = logits[dog_unknown].float()
        log_p_dog = torch.logsumexp(lg[:, :M.IDX_NOT_DOG], 1) - torch.logsumexp(lg, 1)
        losses["isdog"] = 0.5 * (-log_p_dog).mean()
    has_size = size >= 0
    if has_size.any():
        losses["size"] = 0.5 * F.cross_entropy(size_logits[has_size], size[has_size], label_smoothing=0.05)
    has_age = age >= 0
    if has_age.any():
        losses["age"] = F.cross_entropy(age_logits[has_age], age[has_age], label_smoothing=0.05)
    return sum(losses.values()), losses


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    probs, sizes_p, ages_p, cls_all, size_all, age_all = [], [], [], [], [], []
    for x, cls, size, age in loader:
        x = x.to(device, non_blocking=True)
        with torch.amp.autocast("cuda"):
            lg, slg, alg = model(x)
        probs.append(torch.softmax(lg.float(), 1).cpu())
        sizes_p.append(slg.float().argmax(1).cpu())
        ages_p.append(alg.float().argmax(1).cpu())
        cls_all.append(cls); size_all.append(size); age_all.append(age)
    P = torch.cat(probs); SP = torch.cat(sizes_p); AP = torch.cat(ages_p)
    C = torch.cat(cls_all); S = torch.cat(size_all); A = torch.cat(age_all)
    pred = P.argmax(1)
    p_notdog = P[:, M.IDX_NOT_DOG:].sum(1)

    def rate(mask, ok):
        n = int(mask.sum())
        return (float((ok & mask).sum()) / n, n) if n else (float("nan"), 0)

    breed = (C >= 0) & (C < M.IDX_OTRO)
    otro = C == M.IDX_OTRO
    notdog = C >= M.IDX_NOT_DOG
    dog = ((C >= 0) & (C <= M.IDX_OTRO)) | ((C == -1) & (A >= 0))
    m = {
        "breed_acc": rate(breed, pred == C),
        "otro_recall": rate(otro, pred == M.IDX_OTRO),
        "notdog_recall": rate(notdog, p_notdog > 0.5),
        "notdog_type_acc": rate(notdog, pred == C),
        "dog_false_reject": rate(dog, p_notdog > 0.5),
        "size_acc": rate(S >= 0, SP == S),
        "age_acc": rate(A >= 0, AP == A),
    }
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=14)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--all-data", action="store_true", help="entrena con train+val (modelo final)")
    ap.add_argument("--out", default="dognet_v2")
    args = ap.parse_args()

    torch.manual_seed(42)
    torch.backends.cudnn.benchmark = True
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_rows = load_rows("all" if args.all_data else "train")
    val_rows = load_rows("val")
    print(f"Device: {device} | train={len(train_rows)} val={len(val_rows)} | "
          f"fuentes={sorted(Counter(r['source'] for r in train_rows).items())}")
    has_age = any(r["age"] >= 0 for r in train_rows)

    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.35, 1.0), interpolation=InterpolationMode.BICUBIC),
        transforms.RandomHorizontalFlip(),
        transforms.RandomApply([transforms.ColorJitter(0.3, 0.3, 0.3, 0.03)], p=0.8),
        transforms.RandomGrayscale(p=0.05),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
        transforms.RandomErasing(p=0.15),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize(256, interpolation=InterpolationMode.BICUBIC),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])

    sampler, n_epoch = make_sampler(train_rows)
    train_loader = DataLoader(ManifestDataset(train_rows, train_tf), batch_size=args.batch,
                              sampler=sampler, num_workers=args.workers, pin_memory=True,
                              drop_last=True, persistent_workers=True)
    val_loader = DataLoader(ManifestDataset(val_rows, eval_tf), batch_size=64, shuffle=False,
                            num_workers=4, pin_memory=True, persistent_workers=True)

    model = DogNetV2(M.N_CLASSES).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    steps = args.epochs * (n_epoch // args.batch)
    warm = n_epoch // args.batch
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / warm) * 0.5 * (1 + math.cos(math.pi * min(1.0, s / steps))))
    scaler = torch.amp.GradScaler("cuda")

    meta = {"classes": M.CLASSES, "breeds": M.BREEDS, "otro_index": M.IDX_OTRO,
            "not_dog_index": M.IDX_NOT_DOG, "not_dog_types": M.NOT_DOG, "sizes": M.SIZES,
            "ages": M.AGES, "size_weight_kg": M.SIZE_WEIGHT_KG, "has_age": has_age,
            "img_size": 224, "trained_on": "all" if args.all_data else "train"}
    best = -1.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        t0 = time.time(); agg = Counter(); n = 0
        for x, cls, size, age in train_loader:
            x = x.to(device, non_blocking=True)
            cls, size, age = cls.to(device), size.to(device), age.to(device)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda"):
                lg, slg, alg = model(x)
            loss, parts = multitask_loss(lg.float(), slg.float(), alg.float(), cls, size, age)
            scaler.scale(loss).backward()
            scaler.step(opt); scaler.update(); sched.step()
            for k, v in parts.items():
                agg[k] += float(v)
            agg["total"] += float(loss); n += 1
            if n % 150 == 0:
                print(f"    step {n} | loss {agg['total'] / n:.3f} | {n * args.batch / (time.time() - t0):.0f} img/s",
                      flush=True)
        msg = " ".join(f"{k}={v / n:.3f}" for k, v in sorted(agg.items()))
        metrics = evaluate(model, val_loader, device)
        mtxt = " ".join(f"{k}={v[0]:.3f}" for k, v in metrics.items())
        print(f"epoch {epoch:2d}/{args.epochs} | {msg} | {mtxt} | {time.time() - t0:.0f}s", flush=True)

        keys = ["breed_acc", "otro_recall", "notdog_recall"]
        score = sum(metrics[k][0] for k in keys) - 2 * metrics["dog_false_reject"][0]
        if has_age and not math.isnan(metrics["age_acc"][0]):
            score += metrics["age_acc"][0]
        if args.all_data or score >= best:
            best = score
            meta["val_metrics"] = {k: (None if math.isnan(v[0]) else round(v[0], 4))
                                   for k, v in metrics.items()}
            meta["epoch"] = epoch
            torch.save({"state_dict": model.state_dict(), "meta": meta}, OUT_DIR / f"{args.out}.pt")
            with open(OUT_DIR / f"{args.out}.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
            print(f"  -> guardado {args.out}.pt (epoch {epoch})", flush=True)
    print("LISTO", flush=True)


if __name__ == "__main__":
    main()
