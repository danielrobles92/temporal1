"""Clasificador de etapa de vida: CACHORRO (menos de 1 año) vs ADULTO (1 año o más).

Reemplaza al estimador de edad en meses (train_age_e2e.py), que confundía etapas en
fotos reales. Aquí la red solo aprende la frontera que se necesita: menos de 12.5
meses (el límite de las etiquetas de PetFinder.my) o más.

Red: EfficientNetB0 propia (AgeNet con 2 salidas), iniciada con los pesos de DogNet
v2 (que ya sabe "ver perros") y reentrenada completa. Pérdida: entropía cruzada.

Datos (imagesDS/_v2cache/age_manifest.csv), etiqueta binaria:
  petfinder_my  0-12.5 meses -> cachorro; 12.5-29.5 y 30+ meses -> adulto
  openimages    "Puppy" verificado por personas: sí -> cachorro, no -> adulto
                (el split "test" NUNCA se entrena: es la prueba con fotos ajenas)
  dogage_*      adulto (2-6 años) y senior (6+) -> adulto; "joven" (0-2 años) se
                descarta: mezcla cachorros con perros de 1 a 2 años
Muestreo: cada lote ~50 % cachorros / 50 % adultos (SOURCE_MIX).

El umbral de P(cachorro) se elige en VALIDACIÓN (PetFinder.my val + DogAge val,
máxima exactitud balanceada) y se aplica tal cual a Open Images test.

Uso:
  python experiments/train_puppy.py            # entrena con split train, mide en val + test
"""
import argparse
import csv
import json
import sys
import time
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, WeightedRandomSampler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.dognet import AgeNet  # noqa: E402
from train_age_e2e import CACHE, EVAL_TF, MODELS, TRAIN_TF, Rows, auc  # noqa: E402

PUPPY_MAX = 12.5
CLASSES = ["cachorro", "adulto"]
# Fracción de cada lote por (fuente, clase): 50 % cachorros, 50 % adultos.
SOURCE_MIX = {("petfinder_my", 0): 0.42, ("openimages", 0): 0.08,
              ("petfinder_my", 1): 0.16, ("openimages", 1): 0.08, ("dogage", 1): 0.26}
PF_GROUP_TEXT = {"q0-12%": "0-1 meses", "q12-25%": "2 meses", "q25-38%": "3 meses", "q38-50%": "4 meses",
                 "q50-62%": "5-7 meses", "q62-75%": "8-12 meses", "q75-88%": "13-29 meses", "q88-100%": "30+ meses"}


def source_key(r):
    return "dogage" if r["source"].startswith("dogage") else r["source"]


def label(r):
    """0 = cachorro, 1 = adulto, None = no sirve para esta frontera."""
    s = source_key(r)
    if s == "petfinder_my":
        return 0 if float(r["hi"]) <= PUPPY_MAX else 1
    if s == "openimages":
        return 0 if r["group"] == "cachorro" else 1
    return None if r["group"] == "cachorro" else 1      # dogage: joven 0-2 años es ambiguo


def sample_weights(rows, labels):
    cnt = {}
    for r, y in zip(rows, labels):
        cnt[(source_key(r), y)] = cnt.get((source_key(r), y), 0) + 1
    return torch.tensor([SOURCE_MIX[(source_key(r), y)] / cnt[(source_key(r), y)] for r, y in zip(rows, labels)])


@torch.no_grad()
def predict(model, rows, device, bs=128):
    """P(cachorro) con TTA centro + espejo (igual que el servicio)."""
    model.eval()
    out = []
    for x in DataLoader(Rows(rows, EVAL_TF), batch_size=bs, num_workers=6, pin_memory=True):
        x = x.to(device, non_blocking=True)
        with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
            lg = torch.cat([model(x), model(torch.flip(x, dims=[3]))])
        p = torch.softmax(lg.float(), 1)[:, 0]
        out.append(((p[: len(x)] + p[len(x):]) / 2).cpu())
    return torch.cat(out)


def binary_metrics(p, y, thr):
    """y: 0 cachorro / 1 adulto; se predice cachorro si p >= thr."""
    pred_pup = p >= thr
    pup, adu = y == 0, y == 1
    tp, fn = int((pred_pup & pup).sum()), int((~pred_pup & pup).sum())
    fp, tn = int((pred_pup & adu).sum()), int((~pred_pup & adu).sum())
    rec_p = tp / max(1, tp + fn) if pup.any() else None
    rec_a = tn / max(1, tn + fp) if adu.any() else None
    out = {"n": int(len(y)), "n_cachorro": int(pup.sum()), "n_adulto": int(adu.sum()),
           "confusion": {"cachorro_como_cachorro": tp, "cachorro_como_adulto": fn,
                         "adulto_como_cachorro": fp, "adulto_como_adulto": tn},
           "accuracy": round((tp + tn) / max(1, len(y)), 4),
           "recall_cachorro": None if rec_p is None else round(rec_p, 4),
           "recall_adulto": None if rec_a is None else round(rec_a, 4)}
    if rec_p is not None and rec_a is not None:
        out["balanced_accuracy"] = round((rec_p + rec_a) / 2, 4)
        out["precision_cachorro"] = round(tp / max(1, tp + fp), 4)
        out["auc"] = round(auc(p, pup), 4)
    return out


def pick_threshold(p, y):
    """Umbral con mayor exactitud balanceada (empate -> el más cercano a 0.5)."""
    best = (-1.0, 0.5)
    for t in [i / 100 for i in range(5, 96)]:
        pred = p >= t
        ba = (float(pred[y == 0].float().mean()) + float((~pred)[y == 1].float().mean())) / 2
        if ba > best[0] + 1e-9 or (abs(ba - best[0]) <= 1e-9 and abs(t - 0.5) < abs(best[1] - 0.5)):
            best = (ba, t)
    return best[1]


def report(P, rows, labels, thr):
    src = [r["source"] for r in rows]
    y = torch.tensor(labels)
    out = {}
    for name in ("petfinder_my", "dogage_petfinder", "dogage_expert", "openimages"):
        m = torch.tensor([s == name for s in src])
        if m.any():
            out[name] = binary_metrics(P[m], y[m], thr)
    pf = [i for i, r in enumerate(rows) if r["source"] == "petfinder_my"]
    by_group = {}
    for g, text in PF_GROUP_TEXT.items():
        idx = [i for i in pf if rows[i]["group"] == g]
        if idx:
            ok = sum((P[i] >= thr) == (labels[i] == 0) for i in idx)
            by_group[text] = {"n": len(idx), "correctos": round(float(ok) / len(idx), 4)}
    out["petfinder_my_por_edad"] = by_group
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--samples-per-epoch", type=int, default=24000)
    ap.add_argument("--bs", type=int, default=48)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--hidden", type=int, default=256)
    ap.add_argument("--label-smoothing", type=float, default=0.05)
    ap.add_argument("--max-notdog", type=float, default=0.5)
    ap.add_argument("--init", default="dognet_v2_val.pt")
    ap.add_argument("--out", default="dognet_puppy")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    with open(CACHE / "age_manifest.csv", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    # Fotos que DogNet no ve como perro (vectores en cache de train_age.py).
    nd_cache = CACHE / f"age_feats_{Path(args.init).stem}.pt"
    notdog = {}
    if nd_cache.exists():
        c = torch.load(nd_cache, weights_only=True)
        notdog = dict(zip(c["paths"], c["notdog"].tolist()))
    keep = [r for r in rows if notdog.get(r["path"], 0.0) < args.max_notdog and label(r) is not None]
    print(f"Filas útiles: {len(keep)} de {len(rows)} (sin no-perro ni DogAge joven)", flush=True)

    train = [r for r in keep if r["split"] == "train"]
    val = [r for r in keep if r["split"] == "val"]
    test = [r for r in keep if r["split"] == "test"]
    ytr, yva, yte = [label(r) for r in train], [label(r) for r in val], [label(r) for r in test]
    counts = {f"{s}/{CLASSES[k]}": sum(source_key(r) == s and y == k for r, y in zip(train, ytr)) for s, k in SOURCE_MIX}
    print(f"Entrenamiento {len(train)}  validación {len(val)}  prueba {len(test)}  (init {args.init})")
    print("  " + json.dumps(counts, ensure_ascii=False), flush=True)

    model = AgeNet(n_bins=2, hidden=args.hidden)
    sd = torch.load(MODELS / args.init, map_location="cpu", weights_only=True)["state_dict"]
    model.features.load_state_dict({k[len("features."):]: v for k, v in sd.items() if k.startswith("features.")})
    model = model.to(device)
    torch.backends.cudnn.benchmark = True

    sampler = WeightedRandomSampler(sample_weights(train, ytr), args.samples_per_epoch, replacement=True)
    loader = DataLoader(Rows(train, TRAIN_TF, torch.tensor(ytr)), batch_size=args.bs, sampler=sampler,
                        num_workers=8, pin_memory=True, drop_last=True, persistent_workers=True)
    params = [{"params": model.features.parameters(), "lr": args.lr},
              {"params": model.head.parameters(), "lr": args.lr * 3}]
    opt = torch.optim.AdamW(params, weight_decay=1e-4)
    total = args.epochs * len(loader)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[args.lr, args.lr * 3], total_steps=total, pct_start=0.1)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    t0 = time.time()
    history = []
    for ep in range(args.epochs):
        model.train()
        tot, hits, n = 0.0, 0, 0
        for x, y in loader:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
                lg = model(x)
            loss = F.cross_entropy(lg.float(), y, label_smoothing=args.label_smoothing)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            tot, n = tot + loss.item(), n + 1
            hits += int((lg.argmax(1) == y).sum())
            if n % 100 == 0:
                print(f"   paso {n}/{len(loader)}  loss {tot / n:.4f}  {time.time() - t0:.0f}s", flush=True)
        Pv = predict(model, val, device)
        yv = torch.tensor(yva)
        ba = binary_metrics(Pv, yv, 0.5).get("balanced_accuracy")
        history.append({"epoch": ep + 1, "loss": round(tot / n, 4), "train_acc": round(hits / (n * args.bs), 4),
                        "val_balanced_acc@0.5": ba, "seconds": round(time.time() - t0)})
        print(f"ep {ep + 1}/{args.epochs}  " + json.dumps(history[-1]), flush=True)

    train_seconds = round(time.time() - t0)
    Pv = predict(model, val, device)
    thr = pick_threshold(Pv, torch.tensor(yva))
    t1 = time.time()
    Pt = predict(model, test, device)
    per_img = (time.time() - t1) / max(1, len(test))

    result = {"kind": "binary", "classes": CLASSES, "puppy_max_months": PUPPY_MAX, "hidden": args.hidden,
              "init": args.init, "threshold": thr, "trained_on": "train",
              "hyperparameters": {"epochs": args.epochs, "samples_per_epoch": args.samples_per_epoch,
                                  "batch_size": args.bs, "optimizer": "AdamW", "lr_backbone": args.lr,
                                  "lr_head": args.lr * 3, "weight_decay": 1e-4, "scheduler": "OneCycleLR (10 % warmup)",
                                  "label_smoothing": args.label_smoothing, "mixed_precision": device.type == "cuda",
                                  "source_mix": {f"{s}/{CLASSES[k]}": v for (s, k), v in SOURCE_MIX.items()}},
              "n_train": counts, "n_val": len(val), "n_test": len(test), "history": history,
              "train_seconds": train_seconds, "eval_seconds_per_image": round(per_img, 5),
              "val_metrics": report(Pv, val, yva, thr), "test_metrics": report(Pt, test, yte, thr),
              "test_metrics_at_0.5": binary_metrics(Pt, torch.tensor(yte), 0.5)}
    torch.save({"state_dict": model.cpu().state_dict(), "meta": result}, MODELS / f"{args.out}.pt")
    torch.save({"val_paths": [r["path"] for r in val], "P_val": Pv, "test_paths": [r["path"] for r in test], "P_test": Pt},
               CACHE / f"puppy_pred_{args.out}.pt")
    (MODELS / f"{args.out}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"-> models/{args.out}.pt")


if __name__ == "__main__":
    main()
