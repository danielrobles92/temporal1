"""Estimador de edad v3: EfficientNetB0 afinado de punta a punta para la EDAD.

Problema de la v2 (train_age.py): AgeHead se entrenaba sobre el vector de DogNet v2
CONGELADO. Ese vector se aprendio para reconocer razas y, para eso, la red aprende a
ignorar si el perro es joven o viejo (un cachorro y un adulto Husky deben dar la misma
raza). Resultado medido en validacion: 16 % de los cachorros de 5-7 meses y 34 % de los
de 8-12 meses salian "adulto".

v3: una red EfficientNetB0 PROPIA para la edad (se inicia con los pesos de DogNet v2,
que ya sabe "ver perros", y se reentrena completa), con la misma cabeza por rangos y la
misma perdida por intervalos (-log P(edad dentro del intervalo de la etiqueta)).

Datos (imagesDS/_v2cache/age_manifest.csv):
  petfinder_my  meses de cachorro (0-1, 2, 3, 4, 5-7, 8-12, 13-29, 30+)
  dogage_*      joven 0-2 / adulto 2-6 / senior 6+ anios
  openimages    cachorro SI / NO verificado por personas (prepare_age_openimages.py);
                el split "test" NUNCA se usa para entrenar (prueba con fotos ajenas)

Uso:
  python experiments/train_age_e2e.py --val     # metricas honestas (init dognet_v2_val)
  python experiments/train_age_e2e.py           # final (init dognet_v2, todo menos test)
"""
import argparse
import csv
import json
import math
import sys
import time
from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image, ImageFile, ImageFilter
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights
from torchvision.transforms import InterpolationMode

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.dognet import AGE_EDGES, AgeNet, age_estimate  # noqa: E402

CACHE = ROOT.parent / "imagesDS" / "_v2cache"
MODELS = ROOT / "models"
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
Q_RANGE = (0.2, 0.8)
PUPPY_MAX = 12.5                      # "cachorro" = menos de 1 anio
# Fraccion de cada lote por fuente (dentro de la fuente, grupos balanceados ^ --balance).
SOURCE_MIX = {"petfinder_my": 0.40, "dogage": 0.40, "openimages": 0.20}
PF_GROUPS = ["q0-12%", "q12-25%", "q25-38%", "q38-50%", "q50-62%", "q62-75%", "q75-88%", "q88-100%"]
PF_TYPICAL = [1, 2, 3, 4, 6, 10, 20, 48]
PF_EDGES = [1.5, 2.5, 3.5, 4.5, 7.5, 12.5, 29.5]
DA_STAGE = {"cachorro": 0, "adulto": 1, "senior": 2}


def label_mask(lo, hi):
    """Fraccion (en log-meses) de cada rango de AGE_EDGES dentro de [lo, hi]."""
    lo, hi = math.log(max(lo, 0.5)), math.log(min(hi, AGE_EDGES[-1]))
    m = []
    for k in range(len(AGE_EDGES) - 1):
        a, b = math.log(max(AGE_EDGES[k], 0.5)), math.log(AGE_EDGES[k + 1])
        m.append(max(0.0, min(b, hi) - max(a, lo)) / (b - a))
    return m


class RandomLowQuality:
    """Fotos de celular reales: a veces borrosas o de baja resolucion."""

    def __init__(self, p=0.25):
        self.p = p

    def __call__(self, img):
        if torch.rand(1).item() >= self.p:
            return img
        if torch.rand(1).item() < 0.5:
            return img.filter(ImageFilter.GaussianBlur(radius=float(torch.empty(1).uniform_(0.5, 2.0))))
        s = float(torch.empty(1).uniform_(0.25, 0.6))
        w, h = img.size
        return img.resize((max(16, int(w * s)), max(16, int(h * s))), Image.BILINEAR).resize((w, h), Image.BILINEAR)


TRAIN_TF = transforms.Compose([
    RandomLowQuality(),
    transforms.RandomResizedCrop(224, scale=(0.4, 1.0), ratio=(0.75, 1.33), interpolation=InterpolationMode.BICUBIC),
    transforms.RandomHorizontalFlip(),
    transforms.RandomApply([transforms.RandomRotation(12)], p=0.3),
    transforms.ColorJitter(0.3, 0.3, 0.2, 0.03),
    transforms.RandomGrayscale(0.03),
    transforms.ToTensor(), transforms.Normalize(MEAN, STD),
    transforms.RandomErasing(p=0.15, scale=(0.02, 0.12)),
])
EVAL_TF = EfficientNet_B0_Weights.IMAGENET1K_V1.transforms()    # igual que el servicio


class Rows(Dataset):
    def __init__(self, rows, tf, masks=None):
        self.rows, self.tf, self.masks = rows, tf, masks

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        x = self.tf(Image.open(CACHE / self.rows[i]["path"]).convert("RGB"))
        return (x, self.masks[i]) if self.masks is not None else x


def source_key(r):
    return "dogage" if r["source"].startswith("dogage") else r["source"]


def sample_weights(rows, balance):
    cnt_src, cnt_grp = {}, {}
    for r in rows:
        s = source_key(r)
        cnt_src[s] = cnt_src.get(s, 0) + 1
        cnt_grp[(s, r["group"])] = cnt_grp.get((s, r["group"]), 0) + 1
    # peso de grupo ^ -balance, normalizado para que cada fuente sume su SOURCE_MIX
    w = [cnt_grp[(source_key(r), r["group"])] ** -balance for r in rows]
    tot = {}
    for r, x in zip(rows, w):
        tot[source_key(r)] = tot.get(source_key(r), 0.0) + x
    return torch.tensor([x / tot[source_key(r)] * SOURCE_MIX[source_key(r)] for r, x in zip(rows, w)])


@torch.no_grad()
def predict(model, rows, device, bs=128):
    """P(rango) con TTA centro + espejo (como el servicio)."""
    model.eval()
    out = []
    for x in DataLoader(Rows(rows, EVAL_TF), batch_size=bs, num_workers=6, pin_memory=True):
        x = x.to(device, non_blocking=True)
        with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
            lg = torch.cat([model(x), model(torch.flip(x, dims=[3]))])
        p = torch.softmax(lg.float(), 1)
        out.append(((p[: len(x)] + p[len(x):]) / 2).cpu())
    return torch.cat(out)


def metrics(P, rows):
    """Metricas por fuente. "cachorro llamado adulto" = mediana >= 12.5 meses."""
    est = [age_estimate(p, Q_RANGE) for p in P.tolist()]
    months = torch.tensor([e["months"] for e in est])
    lo_m = torch.tensor([e["min_months"] for e in est])
    hi_m = torch.tensor([e["max_months"] for e in est])
    lo = torch.tensor([float(r["lo"]) for r in rows])
    hi = torch.tensor([float(r["hi"]) for r in rows])
    hits = (lo_m <= hi) & (hi_m >= lo)
    p_puppy = P[:, : AGE_EDGES.index(PUPPY_MAX)].sum(1)
    src = [r["source"] for r in rows]
    out = {}

    pf = torch.tensor([s == "petfinder_my" for s in src])
    if pf.any():
        g = torch.tensor([PF_GROUPS.index(r["group"]) if r["source"] == "petfinder_my" else 0 for r in rows])
        pred_g = torch.bucketize(months, torch.tensor(PF_EDGES))
        err = (months - torch.tensor([float(PF_TYPICAL[i]) for i in g])).abs()
        pup, adult = pf & (g <= 5), pf & (g >= 6)
        out["petfinder_my"] = {
            "n": int(pf.sum()),
            "group_acc": float((pred_g == g)[pf].float().mean()),
            "group_pm1": float(((pred_g - g).abs() <= 1)[pf].float().mean()),
            "range_hits": float(hits[pf].float().mean()),
            "puppies_median_ae_months": float(err[pup].median()),
            "puppy_vs_adult_acc": float(((months < PUPPY_MAX) == (g <= 5))[pf].float().mean()),
            "puppy_recall": float((months < PUPPY_MAX)[pup].float().mean()),
            "adult_recall": float((months >= PUPPY_MAX)[adult].float().mean()),
            "puppy_called_adult_by_group": {PF_GROUPS[i]: round(float((months >= PUPPY_MAX)[pf & (g == i)].float().mean()), 3)
                                            for i in range(6)},
            "group_acc_by_group": {PF_GROUPS[i]: round(float((pred_g == g)[pf & (g == i)].float().mean()), 3)
                                   for i in range(len(PF_GROUPS))},
        }
    for name in ("dogage_expert", "dogage_petfinder"):
        m = torch.tensor([s == name for s in src])
        if not m.any():
            continue
        true3 = torch.tensor([DA_STAGE.get(r["group"], -1) for r in rows])
        stage3 = torch.bucketize(months, torch.tensor([24.0, 72.0]))
        out[name] = {"n": int(m.sum()),
                     "acc3": float((stage3 == true3)[m].float().mean()),
                     "recall3": [round(float((stage3 == k)[m & (true3 == k)].float().mean()), 3) for k in range(3)],
                     "range_hits": float(hits[m].float().mean()),
                     "adult_senior_called_puppy": float((months < PUPPY_MAX)[m & (true3 >= 1)].float().mean())}
    oi = torch.tensor([s == "openimages" for s in src])
    if oi.any():
        y = torch.tensor([r["group"] == "cachorro" for r in rows])
        pred = months < PUPPY_MAX
        out["openimages"] = {"n": int(oi.sum()), "n_puppy": int((oi & y).sum()), "n_not_puppy": int((oi & ~y).sum()),
                             "acc": float((pred == y)[oi].float().mean()),
                             "puppy_recall": float(pred[oi & y].float().mean()),
                             "not_puppy_recall": float((~pred)[oi & ~y].float().mean()),
                             "puppy_called_adult": float((~pred)[oi & y].float().mean()),
                             "auc": auc(p_puppy[oi], y[oi])}
    return out


def auc(score, y):
    pos, neg = score[y], score[~y]
    if len(pos) == 0 or len(neg) == 0:
        return None
    return float((pos[:, None] > neg[None, :]).float().mean() + 0.5 * (pos[:, None] == neg[None, :]).float().mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--val", action="store_true")
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--samples-per-epoch", type=int, default=24000)
    ap.add_argument("--bs", type=int, default=48)
    ap.add_argument("--lr", type=float, default=4e-4)
    ap.add_argument("--hidden", type=int, default=256)
    ap.add_argument("--balance", type=float, default=0.75)
    ap.add_argument("--max-notdog", type=float, default=0.5)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    init = "dognet_v2_val.pt" if args.val else "dognet_v2.pt"
    with open(CACHE / "age_manifest.csv", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    # Descarta las fotos que DogNet no ve como perro (vectores en cache de train_age.py).
    nd_cache = CACHE / f"age_feats_{Path(init).stem}.pt"
    notdog = {}
    if nd_cache.exists():
        c = torch.load(nd_cache, weights_only=True)
        notdog = dict(zip(c["paths"], c["notdog"].tolist()))
    keep = [r for r in rows if notdog.get(r["path"], 0.0) < args.max_notdog]
    print(f"Descartadas por no-perro: {len(rows) - len(keep)} de {len(rows)}", flush=True)

    train = [r for r in keep if r["split"] == "train" or (not args.val and r["split"] == "val")]
    evalset = [r for r in keep if r["split"] == "test" or (args.val and r["split"] == "val")]
    print(f"Entrenamiento: {len(train)}  Evaluacion: {len(evalset)}  (init {init})")
    for s in SOURCE_MIX:
        print(f"   {s}: {sum(source_key(r) == s for r in train)}")

    model = AgeNet(hidden=args.hidden)
    sd = torch.load(MODELS / init, map_location="cpu", weights_only=True)["state_dict"]
    model.features.load_state_dict({k[len("features."):]: v for k, v in sd.items() if k.startswith("features.")})
    model = model.to(device)
    torch.backends.cudnn.benchmark = True

    masks = torch.tensor([label_mask(float(r["lo"]), float(r["hi"])) for r in train])
    sampler = WeightedRandomSampler(sample_weights(train, args.balance), args.samples_per_epoch, replacement=True)
    loader = DataLoader(Rows(train, TRAIN_TF, masks), batch_size=args.bs, sampler=sampler,
                        num_workers=8, pin_memory=True, drop_last=True, persistent_workers=True)
    params = [{"params": model.features.parameters(), "lr": args.lr},
              {"params": model.head.parameters(), "lr": args.lr * 3}]
    opt = torch.optim.AdamW(params, weight_decay=1e-4)
    total = args.epochs * len(loader)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[args.lr, args.lr * 3], total_steps=total, pct_start=0.1)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    t0 = time.time()
    for ep in range(args.epochs):
        model.train()
        tot, n = 0.0, 0
        for x, m in loader:
            x = x.to(device, non_blocking=True)
            m = m.to(device, non_blocking=True)
            with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
                lg = model(x)
            logp = F.log_softmax(lg.float(), 1)
            loss = -torch.logsumexp(logp + torch.log(m + 1e-12), 1).mean()
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            tot, n = tot + loss.item(), n + 1
            if n % 100 == 0:
                print(f"   paso {n}/{len(loader)}  loss {tot / n:.4f}  {time.time() - t0:.0f}s", flush=True)
        print(f"ep {ep + 1}/{args.epochs}  loss {tot / n:.4f}  {time.time() - t0:.0f}s", flush=True)

    result = {"kind": "e2e", "init": init, "edges_months": AGE_EDGES, "hidden": args.hidden,
              "q_range": list(Q_RANGE), "puppy_max_months": PUPPY_MAX, "stage_alpha": 0.0,
              "trained_on": "train" if args.val else "all-but-test", "epochs": args.epochs,
              "n_train": {s: sum(source_key(r) == s for r in train) for s in SOURCE_MIX},
              "train_seconds": round(time.time() - t0)}
    t1 = time.time()
    P = predict(model, evalset, device)
    result["eval_seconds_per_image"] = round((time.time() - t1) / max(1, len(evalset)), 5)
    result["eval_metrics"] = metrics(P, evalset)
    result["eval_on"] = "val + openimages test" if args.val else "openimages test"
    name = args.out or ("dognet_age_v3_val" if args.val else "dognet_age_v3")
    torch.save({"state_dict": model.cpu().state_dict(), "meta": result}, MODELS / f"{name}.pt")
    torch.save({"paths": [r["path"] for r in evalset], "P": P}, CACHE / f"age_pred_{name}.pt")
    (MODELS / f"{name}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"-> models/{name}.pt")


if __name__ == "__main__":
    main()
