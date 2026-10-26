"""Entrena el estimador de edad en meses (AgeHead) sobre DogNet v2 congelado.

Ningun dataset publico trae la edad exacta de cada foto: solo intervalos
(PetFinder.my: 0-1, 2, 3, 4, 5-7, 8-12, 13-29, 30+ meses; DogAge: 0-2, 2-6, 6+ anios).
AgeHead predice una distribucion sobre los rangos de app.dognet.AGE_EDGES (los
limites de esas etiquetas) y la perdida es -log P(edad dentro del intervalo de la
etiqueta), contando en proporcion (escala log) los rangos que solo se solapan en parte. Asi aprende a la vez el detalle
de cachorros (PetFinder.my) y la separacion adulto / senior (DogAge). La estimacion
es la mediana de la distribucion y el rango, sus cuantiles 20-80 %.

En el servicio la distribucion se combina con la cabeza de edad de DogNet
(cachorro/adulto/senior, entrenada de punta a punta) como producto de expertos
(--stage-alpha): sube la deteccion de seniors sin perder el detalle de cachorros.

Se probo tambien una regresion normal en log(meses): menor error medio pero casi
nunca decia "senior" (8-17 % de los seniors) y acertaba menos el grupo de meses.

El backbone (y las cabezas de raza / no-perro / tamano) NO se modifica: solo se
entrena una cabeza pequena sobre el vector de 1280-d, que el servicio carga aparte
(models/dognet_age.pt). Los vectores se extraen una vez y se guardan en cache.

Uso:
  python experiments/prepare_age.py                       # una vez
  python experiments/train_age.py --val                   # metricas honestas (backbone _val)
  python experiments/train_age.py                         # final: todo, backbone desplegado
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
from PIL import Image, ImageFile
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights
from torchvision.transforms import InterpolationMode

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.dognet import AGE_EDGES, AgeHead, DogNetV2, age_estimate, combine_with_stage  # noqa: E402

CACHE = ROOT.parent / "imagesDS" / "_v2cache"
MODELS = ROOT / "models"
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
N_AUG = 2                     # vistas aumentadas extra por foto de entrenamiento
Q_RANGE = (0.2, 0.8)
# Grupos de PetFinder.my en orden, su valor tipico en meses y sus limites.
PF_GROUPS = ["q0-12%", "q12-25%", "q25-38%", "q38-50%", "q50-62%", "q62-75%", "q75-88%", "q88-100%"]
PF_TYPICAL = [1, 2, 3, 4, 6, 10, 20, 48]
PF_EDGES = [1.5, 2.5, 3.5, 4.5, 7.5, 12.5, 29.5]
STAGE_IDX = {"cachorro": 0, "adulto": 1, "senior": 2}


class Rows(Dataset):
    def __init__(self, rows, tf):
        self.rows, self.tf = rows, tf

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        return self.tf(Image.open(CACHE / self.rows[i]["path"]).convert("RGB"))


@torch.no_grad()
def extract(model, rows, tf, device, desc):
    """Vectores de 1280-d (fp16) y P(no perro) de la cabeza de clases."""
    loader = DataLoader(Rows(rows, tf), batch_size=128, num_workers=6, pin_memory=True)
    feats, notdog = [], []
    t0 = time.time()
    for k, x in enumerate(loader):
        x = x.to(device, non_blocking=True)
        with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
            f = model.embed(x)
        feats.append(f.half().cpu())
        p = torch.softmax(model.cls_head(f.float()), 1)
        notdog.append(p[:, model.cls_head.out_features - 4:].sum(1).cpu())
        if k % 40 == 0:
            print(f"  [{desc}] {k * 128}/{len(rows)}  {time.time() - t0:.0f}s", flush=True)
    return torch.cat(feats), torch.cat(notdog)


def load_features(backbone_name, rows, device):
    """Cache por backbone: vista central, espejo y N_AUG vistas aumentadas."""
    cache_file = CACHE / f"age_feats_{Path(backbone_name).stem}.pt"
    if cache_file.exists():
        c = torch.load(cache_file, weights_only=True)
        if c["paths"] == [r["path"] for r in rows]:
            print(f"Vectores desde cache: {cache_file.name}")
            return c
    ckpt = torch.load(MODELS / backbone_name, map_location="cpu", weights_only=True)
    meta = ckpt["meta"]
    model = DogNetV2(len(meta["classes"]), len(meta["sizes"]), len(meta["ages"]), pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model = model.eval().to(device)
    center = EfficientNet_B0_Weights.IMAGENET1K_V1.transforms()     # igual que el servicio
    flip = transforms.Compose([center, transforms.RandomHorizontalFlip(p=1.0)])
    aug = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.45, 1.0), interpolation=InterpolationMode.BICUBIC),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(0.2, 0.2, 0.15),
        transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    torch.manual_seed(0)
    views, notdog = [], None
    for name, tf in [("centro", center), ("espejo", flip)] + [(f"aug{i}", aug) for i in range(N_AUG)]:
        f, nd = extract(model, rows, tf, device, name)
        views.append(f)
        notdog = nd if notdog is None else notdog
    old_age = torch.softmax(model.age_head(((views[0].float() + views[1].float()) / 2).to(device)), 1).cpu()
    c = {"paths": [r["path"] for r in rows], "views": torch.stack(views, 1),   # [N, V, 1280]
         "notdog": notdog, "old_age": old_age}
    torch.save(c, cache_file)
    print(f"Vectores guardados: {cache_file.name}")
    return c


def label_mask(lo, hi):
    """Fraccion (en log-meses) de cada rango de AGE_EDGES dentro de [lo, hi]."""
    lo, hi = math.log(max(lo, 0.5)), math.log(min(hi, AGE_EDGES[-1]))
    m = []
    for k in range(len(AGE_EDGES) - 1):
        a, b = math.log(max(AGE_EDGES[k], 0.5)), math.log(AGE_EDGES[k + 1])
        m.append(max(0.0, min(b, hi) - max(a, lo)) / (b - a))
    assert any(x > 0.01 for x in m), (lo, hi)
    return m


def metrics(P, rows, old_age):
    est = [age_estimate(p, Q_RANGE) for p in P.tolist()]
    months = torch.tensor([e["months"] for e in est])
    lo_m = torch.tensor([e["min_months"] for e in est])
    hi_m = torch.tensor([e["max_months"] for e in est])
    stage = torch.tensor([STAGE_IDX[e["stage"]] for e in est])
    lo = torch.tensor([float(r["lo"]) for r in rows])
    hi = torch.tensor([float(r["hi"]) for r in rows])
    hits = (lo_m <= hi) & (hi_m >= lo)                      # el rango mostrado toca la etiqueta
    src = [r["source"] for r in rows]
    out = {}
    pf = torch.tensor([x == "petfinder_my" for x in src])
    g = torch.tensor([PF_GROUPS.index(r["group"]) if r["source"] == "petfinder_my" else 0 for r in rows])
    pred_g = torch.bucketize(months, torch.tensor(PF_EDGES))
    err = (months - torch.tensor([float(PF_TYPICAL[i]) for i in g])).abs()
    pup = pf & (g <= 5)                                     # <= 12 meses
    out.update({
        "pf_n": int(pf.sum()),
        "pf_group_acc": float((pred_g == g)[pf].float().mean()),
        "pf_group_pm1": float(((pred_g - g).abs() <= 1)[pf].float().mean()),
        "pf_range_hits": float(hits[pf].float().mean()),
        "pf_mae_months": float(err[pf].mean()),
        "pf_median_ae_months": float(err[pf].median()),
        "pf_puppies_median_ae_months": float(err[pup].median()),
        "pf_puppy_vs_adult_acc": float(((months < 12.5) == (g <= 5))[pf & (g != 6)].float().mean()),
        "pf_group_acc_by_group": {PF_GROUPS[i]: round(float((pred_g == g)[pf & (g == i)].float().mean()), 3)
                                  for i in range(len(PF_GROUPS))},
    })
    true3 = torch.tensor([STAGE_IDX.get(r["group"], -1) for r in rows])
    for name in ("dogage_expert", "dogage_petfinder"):
        m = torch.tensor([x == name for x in src])
        out[f"{name}_n"] = int(m.sum())
        out[f"{name}_acc3"] = float((stage == true3)[m].float().mean())
        out[f"{name}_acc3_old_head"] = float((old_age.argmax(1) == true3)[m].float().mean())
        out[f"{name}_recall3"] = [round(float((stage == k)[m & (true3 == k)].float().mean()), 3) for k in range(3)]
        out[f"{name}_range_hits"] = float(hits[m].float().mean())
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--val", action="store_true", help="entrena con train y mide en val (backbone _val)")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--hidden", type=int, default=256)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--max-notdog", type=float, default=0.5, help="descarta fotos que DogNet no ve como perro")
    ap.add_argument("--balance", type=float, default=0.75,
                    help="0 = muestreo natural, 1 = cada grupo de edad con la misma frecuencia")
    ap.add_argument("--stage-alpha", type=float, default=1.0,
                    help="peso de la cabeza cachorro/adulto/senior de DogNet al combinar (0 = no usarla)")
    ap.add_argument("--out", default=None, help="nombre del archivo en models/ (sin extension)")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    backbone = "dognet_v2_val.pt" if args.val else "dognet_v2.pt"
    with open(CACHE / "age_manifest.csv", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    c = load_features(backbone, rows, device)
    keep = c["notdog"] < args.max_notdog
    print(f"Fotos que DogNet no ve como perro (descartadas): {int((~keep).sum())} de {len(rows)}")

    is_train = torch.tensor([(r["split"] == "train") or not args.val for r in rows]) & keep
    is_pf = torch.tensor([r["source"] == "petfinder_my" for r in rows])
    masks = torch.tensor([label_mask(float(r["lo"]), float(r["hi"])) for r in rows])
    tr = is_train.nonzero().squeeze(1)
    tr_pf, tr_da = tr[is_pf[tr]], tr[~is_pf[tr]]
    print(f"Entrenamiento: {len(tr_pf)} PetFinder.my + {len(tr_da)} DogAge ({backbone})")

    # Pesos de muestreo: con --balance 1 cada grupo de edad sale igual de seguido
    # (hay muchos menos seniors y cachorros de 4 meses que adultos jovenes).
    groups = [r["group"] for r in rows]

    def sample_weights(idx):
        cnt = {}
        for j in idx.tolist():
            cnt[groups[j]] = cnt.get(groups[j], 0) + 1
        return torch.tensor([cnt[groups[j]] ** -args.balance for j in idx.tolist()])

    w_pf, w_da = sample_weights(tr_pf), sample_weights(tr_da)

    torch.manual_seed(42)
    head = AgeHead(hidden=args.hidden).to(device)
    opt = torch.optim.AdamW(head.parameters(), lr=args.lr, weight_decay=1e-3)
    steps_per_epoch, bs = 60, 256
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * steps_per_epoch)
    Vd, log_masks = c["views"].to(device), torch.log(masks + 1e-12).to(device)

    def predict(idx):
        head.eval()
        with torch.no_grad():                                    # centro + espejo (como el servicio)
            p = sum(F.softmax(head(Vd[idx, v].float()), 1) for v in (0, 1)).cpu() / 2
        return combine_with_stage(p, c["old_age"][idx.cpu()], args.stage_alpha)

    is_val = (torch.tensor([r["split"] == "val" for r in rows]) & keep) if args.val else None
    for ep in range(args.epochs):
        head.train()
        tot = 0.0
        for _ in range(steps_per_epoch):
            # mitad PetFinder.my (detalle en meses) y mitad DogAge (adulto/senior)
            i = torch.cat([tr_pf[torch.multinomial(w_pf, bs // 2, replacement=True)],
                           tr_da[torch.multinomial(w_da, bs // 2, replacement=True)]]).to(device)
            v = torch.randint(Vd.shape[1], (len(i),), device=device)
            logp = F.log_softmax(head(Vd[i, v].float()), 1)
            loss = -torch.logsumexp(logp + log_masks[i], 1).mean()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            tot += loss.item()
        if (ep + 1) % 20 == 0 or ep == 0:
            print(f"ep {ep + 1:3d}  loss {tot / steps_per_epoch:.4f}", flush=True)

    result = {"backbone": backbone, "edges_months": AGE_EDGES, "hidden": args.hidden,
              "q_range": list(Q_RANGE), "balance": args.balance, "stage_alpha": args.stage_alpha,
              "trained_on": "train" if args.val else "all", "epochs": args.epochs,
              "n_train": {"petfinder_my": len(tr_pf), "dogage": len(tr_da)}}
    if is_val is not None:
        vi = is_val.nonzero().squeeze(1)
        P = predict(vi.to(device))
        vrows = [rows[j] for j in vi.tolist()]
        result["val_metrics"] = metrics(P, vrows, c["old_age"][vi])
        step = max(1, len(vi) // 10)
        result["examples"] = [{"label": f'{vrows[j]["source"]}:{vrows[j]["group"]}',
                               **age_estimate(P[j].tolist(), Q_RANGE)} for j in range(0, len(vi), step)]
    elif (MODELS / "dognet_age_val.json").exists():
        # El modelo final ya vio todas las fotos: se informan las metricas de la corrida --val.
        val = json.loads((MODELS / "dognet_age_val.json").read_text(encoding="utf-8"))
        result["val_metrics"] = val.get("val_metrics")
        result["val_metrics_from"] = "dognet_age_val"
    name = args.out or ("dognet_age_val" if args.val else "dognet_age")
    torch.save({"state_dict": head.cpu().state_dict(), "meta": result}, MODELS / f"{name}.pt")
    (MODELS / f"{name}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"-> models/{name}.pt")


if __name__ == "__main__":
    main()
