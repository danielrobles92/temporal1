"""Evalua DogNet v2 y calibra los umbrales de decision.

Sobre el split de validacion (fotos que el modelo NO vio si se entreno sin
--all-data) mide:
  - perro vs no-perro (rechazo de perros reales, deteccion de gato/peluche/...)
  - raza correcta para las 20 razas y deteccion de "Otro"
  - tamano y edad
y elige:
  not_dog   : P(no perro) minima para rechazar la imagen
  breed_min : confianza minima de raza; por debajo se responde "Otro"
  teddy_imagenet / wild_imagenet : segunda opinion de la cabeza ImageNet
Escribe models/<modelo>_thresholds.json (lo lee app/analyzer.py).

Uso:
  python experiments/eval_v2.py                       # valida y escribe umbrales
  python experiments/eval_v2.py --split train --no-write   # chequeo sobre fotos de entrenamiento
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0
from torchvision.transforms import InterpolationMode

import v2_meta as M
from train_v2 import CACHE, MEAN, STD, ManifestDataset, load_rows

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.dognet import DogNetV2  # noqa: E402

TEDDY, CAT0, CAT1, WILD0, WILD1, DOG0, DOG1 = 850, 281, 286, 269, 281, 151, 269


@torch.no_grad()
def collect(model, imnet, loader, device):
    P, S, A, G = [], [], [], []
    for x, *_ in loader:
        x = x.to(device)
        with torch.amp.autocast("cuda"):
            lg, slg, alg = model(x)
            ilg = imnet(x)
        P.append(torch.softmax(lg.float(), 1).cpu())
        S.append(slg.float().argmax(1).cpu())
        A.append(alg.float().argmax(1).cpu())
        ip = torch.softmax(ilg.float(), 1).cpu()
        G.append(torch.stack([ip[:, TEDDY], ip[:, WILD0:WILD1].sum(1), ip[:, DOG0:DOG1].sum(1),
                              ip[:, CAT0:CAT1].sum(1)], 1))
    return torch.cat(P), torch.cat(S), torch.cat(A), torch.cat(G)


def decide(P, G, t_nd, t_breed, t_teddy, t_wild, t_rescue, rescue_cap=0.8):
    """Replica la logica de app/analyzer.py. Devuelve indice de clase final."""
    p_nd = P[:, M.IDX_NOT_DOG:]
    # rescate: ImageNet seguro de que es perro (y no peluche) -> se acepta como perro
    rescue = (G[:, 2] >= t_rescue) & (G[:, 0] < min(t_teddy, 0.5)) & (p_nd.sum(1) < rescue_cap)
    not_dog = (p_nd.sum(1) >= t_nd) & ~rescue
    nd_type = p_nd.argmax(1) + M.IDX_NOT_DOG
    teddy = ~not_dog & (G[:, 0] >= t_teddy)
    wild = ~not_dog & ~teddy & (G[:, 1] >= t_wild)
    dog_p = P[:, :M.IDX_OTRO + 1]
    dog_p = dog_p / dog_p.sum(1, keepdim=True)
    conf, best = dog_p.max(1)
    breed = torch.where((best != M.IDX_OTRO) & (conf >= t_breed), best,
                        torch.full_like(best, M.IDX_OTRO))
    final = torch.where(not_dog, nd_type, breed)
    final = torch.where(teddy, torch.full_like(final, M.IDX_NOT_DOG + M.NOT_DOG.index("peluche")), final)
    final = torch.where(wild, torch.full_like(final, M.IDX_NOT_DOG + M.NOT_DOG.index("animal")), final)
    return final


def report(C, A_true, final, S_true, S_pred, A_pred, src_masks):
    is_breed = (C >= 0) & (C < M.IDX_OTRO)
    is_otro = C == M.IDX_OTRO
    is_nd = C >= M.IDX_NOT_DOG
    is_dog = ((C >= 0) & (C <= M.IDX_OTRO)) | ((C == -1) & (A_true >= 0))
    pred_nd = final >= M.IDX_NOT_DOG

    def r(mask, ok):
        n = int(mask.sum())
        return float((ok & mask).sum()) / n if n else float("nan"), n

    out = {
        "raza_correcta (20 razas)": r(is_breed, final == C),
        "otro_detectado (otras razas/mestizos)": r(is_otro, final == M.IDX_OTRO),
        "no_perro_detectado": r(is_nd, pred_nd),
        "no_perro_tipo_correcto": r(is_nd, final == C),
        "perro_rechazado_por_error": r(is_dog, pred_nd),
        "tamano_correcto": r(S_true >= 0, S_pred == S_true),
        "edad_correcta": r(A_true >= 0, A_pred == A_true),
    }
    for k in M.NOT_DOG:
        idx = M.IDX_NOT_DOG + M.NOT_DOG.index(k)
        out[f"  no_perro:{k} detectado"] = r(C == idx, pred_nd)
    for src, m in src_masks.items():
        if (m & is_dog).any():
            out[f"  [{src}] perro rechazado"] = r(m & is_dog, pred_nd)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="dognet_v2")
    ap.add_argument("--split", default="val", choices=["val", "train", "all"])
    ap.add_argument("--source", default=None, help="evalua solo una fuente (p. ej. oxford)")
    ap.add_argument("--thresholds", default=None, help="usa estos umbrales (JSON) en vez de barrer")
    ap.add_argument("--max-rows", type=int, default=0, help="submuestrea (0 = todo)")
    ap.add_argument("--no-write", action="store_true")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ckpt = torch.load(ROOT / "models" / f"{args.model}.pt", map_location="cpu", weights_only=True)
    model = DogNetV2(M.N_CLASSES, pretrained=False)
    model.load_state_dict(ckpt["state_dict"]); model.eval().to(device)
    imnet = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1).eval().to(device)
    print(f"modelo {args.model} | entrenado con: {ckpt['meta'].get('trained_on')} | epoch {ckpt['meta'].get('epoch')}")

    rows = load_rows(args.split)
    if args.source:
        rows = [r for r in rows if r["source"] == args.source]
    if args.max_rows and len(rows) > args.max_rows:
        g = torch.Generator().manual_seed(0)
        rows = [rows[i] for i in torch.randperm(len(rows), generator=g)[: args.max_rows].tolist()]
    tf = transforms.Compose([transforms.Resize(256, interpolation=InterpolationMode.BICUBIC),
                             transforms.CenterCrop(224), transforms.ToTensor(),
                             transforms.Normalize(MEAN, STD)])
    loader = DataLoader(ManifestDataset(rows, tf), batch_size=64, num_workers=8)
    P, S_pred, A_pred, G = collect(model, imnet, loader, device)
    C = torch.tensor([r["cls"] for r in rows]); S = torch.tensor([r["size"] for r in rows])
    A = torch.tensor([r["age"] for r in rows]); sources = [r["source"] for r in rows]
    src_masks = {s: torch.tensor([x == s for x in sources]) for s in sorted(set(sources))}
    print(f"{args.split}: {len(rows)} imagenes | {dict(Counter(sources))}")

    # --- barrido de umbrales -------------------------------------------------
    # Rechazar la foto de un perro real impide publicar (costo alto); dejar pasar un
    # peluche es menos grave. Por eso el rechazo de perros pesa x10.
    scored = []
    for t_nd in (0.3, 0.4, 0.5, 0.6, 0.7):
        for t_breed in (0.0, 0.3, 0.4, 0.5, 0.6, 0.7):
            for t_teddy in (0.3, 0.5, 0.7, 1.01):
                for t_wild in (0.5, 0.7, 1.01):
                  for t_rescue in (0.5, 0.6, 0.7, 0.8, 0.9, 1.01):
                    f = decide(P, G, t_nd, t_breed, t_teddy, t_wild, t_rescue)
                    m = report(C, A, f, S, S_pred, A_pred, src_masks)
                    breed, otro = m["raza_correcta (20 razas)"][0], m["otro_detectado (otras razas/mestizos)"][0]
                    nd, rej = m["no_perro_detectado"][0], m["perro_rechazado_por_error"][0]
                    # prioridad: no rechazar perros reales, luego raza y Otro, luego no-perro
                    score = breed + otro + nd - 10 * rej
                    scored.append((round(score, 4), t_nd, -t_rescue,
                                   dict(not_dog=t_nd, breed_min=t_breed, teddy_imagenet=t_teddy,
                                        wild_imagenet=t_wild, rescue_imagenet=t_rescue), m))
    # desempate: umbral de no-perro mas alto y rescate mas permisivo (protege perros reales)
    scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    print("\nTop 5 configuraciones (score, raza, otro, no-perro, perro rechazado):")
    for sc, _, _, cfg, mm in scored[:5]:
        print(f"  {sc:.4f} raza={mm['raza_correcta (20 razas)'][0]:.3f} "
              f"otro={mm['otro_detectado (otras razas/mestizos)'][0]:.3f} "
              f"np={mm['no_perro_detectado'][0]:.3f} rej={mm['perro_rechazado_por_error'][0]:.4f} {cfg}")
    _, _, _, th, m = scored[0]
    if args.thresholds:
        th = json.loads(Path(args.thresholds).read_text(encoding="utf-8"))
        th.pop("rescue_max_not_dog", None)
        m = report(C, A, decide(P, G, th["not_dog"], th["breed_min"], th["teddy_imagenet"],
                                th["wild_imagenet"], th["rescue_imagenet"]), S, S_pred, A_pred, src_masks)
    print("\nUmbrales elegidos:", th)
    for k, (v, n) in m.items():
        print(f"  {k:42s} {v * 100:6.1f}%  (n={n})")

    # --- detalle por raza y confusiones --------------------------------------
    f = decide(P, G, th["not_dog"], th["breed_min"], th["teddy_imagenet"], th["wild_imagenet"],
               th["rescue_imagenet"])
    print("\nPor raza (acierto | a que se confunde):")
    for i, b in enumerate(M.BREEDS):
        mask = C == i
        n = int(mask.sum())
        if not n:
            continue
        acc = float((f[mask] == i).float().mean())
        wrong = Counter(M.CLASSES[int(x)] for x in f[mask] if int(x) != i).most_common(2)
        print(f"  {b:34s} {acc * 100:5.1f}% (n={n:3d})  {wrong}")
    otro_err = Counter(M.CLASSES[int(x)] for x in f[C == M.IDX_OTRO] if int(x) != M.IDX_OTRO)
    print("\n'Otro' confundido con:", otro_err.most_common(8))
    nd_err = Counter((M.CLASSES[int(c)], M.CLASSES[int(x)]) for c, x in zip(C, f)
                     if int(c) >= M.IDX_NOT_DOG and int(x) < M.IDX_NOT_DOG)
    print("No-perro aceptado como perro:", nd_err.most_common(8))

    # --- edad: expertos (edad verificada) vs PetFinder --------------------------
    for origin in ("expert", "petfinder"):
        mask = torch.tensor([f"dogage/{origin}/" in r["path"] for r in rows])
        if not mask.any():
            continue
        acc = float((A_pred[mask] == A[mask]).float().mean())
        print(f"\nEdad [{origin}] acierto {acc * 100:.1f}% (n={int(mask.sum())})  filas=real, cols=predicha")
        for i, name in enumerate(M.AGES):
            row = [int(((A[mask] == i) & (A_pred[mask] == j)).sum()) for j in range(len(M.AGES))]
            print(f"   {name:9s} {row}")

    # Un modelo entrenado con --all-data ya vio la validacion: no sirve para calibrar.
    # Sus umbrales (models/dognet_v2_thresholds.json) se toman de la corrida de validacion.
    if not args.no_write and args.split == "val" and ckpt["meta"].get("trained_on") != "all":
        out = ROOT / "models" / f"{args.model}_thresholds.json"
        out.write_text(json.dumps(th, indent=2), encoding="utf-8")
        print(f"\nUmbrales -> {out}")


if __name__ == "__main__":
    main()
