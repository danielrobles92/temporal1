"""Pruebas del modelo v2 contra el ml-service en ejecucion (igual que lo usa el backend).

Ejemplos (con el ml-service levantado en :8000):
  # 10 fotos al azar de cada una de las 20 razas del dataset R3P0 -> % de acierto
  python experiments/probar_modelo.py --dataset 10

  # cualquier foto o carpeta (gatos, peluches, mestizos, fotos de la app...)
  python experiments/probar_modelo.py C:/ruta/foto.jpg C:/ruta/carpeta

  # ambas cosas y guardar el detalle en CSV
  python experiments/probar_modelo.py --dataset 5 ../back/uploads/pets --csv resultados.csv

Para cada imagen muestra: si es perro (o que es), raza u "Otro" con su confianza,
tamano, edad aproximada y color. En el modo --dataset compara con la raza real.
"""
import argparse
import csv
import json
import mimetypes
import random
import urllib.request
import uuid
from pathlib import Path

import v2_meta as M

ROOT = Path(__file__).resolve().parents[1]
R3P0 = ROOT.parent / "imagesDS" / "R3P0"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def describe(url, path):
    """POST multipart a /describe con una imagen."""
    boundary = uuid.uuid4().hex
    ctype = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; "
            f"filename=\"{path.name}\"\r\nContent-Type: {ctype}\r\n\r\n").encode()
    body += path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{url}/describe", data=body, method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())["items"][0]


def summary(d):
    if not d["is_dog"]:
        return f"NO ES PERRO ({d.get('not_dog_type')}) - {d.get('message')}"
    breed = d["breed"] if d["in_catalog"] else f"Otro (parecido a {d['breed_top'][0]['breed']})"
    parts = [f"{breed} {d['breed_confidence'] * 100:.0f}%", d.get("size") or "-"]
    if d.get("age_estimate"):
        parts.append(f"edad ~{d['age_estimate']['text']} ({d['age_estimate']['range_text']})")
    if d.get("age"):
        parts.append(f"{d['age']} ({d['age_years']} anios) {d['age_confidence'] * 100:.0f}%")
    if d.get("color_label"):
        parts.append(d["color_label"] + (f"/{d['color_secondary']}" if d.get("color_secondary") else ""))
    return " | ".join(parts)


def collect(paths):
    out = []
    for p in paths:
        p = Path(p)
        if p.is_dir():
            out += sorted(x for x in p.rglob("*") if x.suffix.lower() in IMG_EXT)
        elif p.suffix.lower() in IMG_EXT:
            out.append(p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*", help="fotos o carpetas a probar")
    ap.add_argument("--dataset", type=int, default=0, help="N fotos por raza de R3P0")
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--csv", default=None)
    args = ap.parse_args()

    rows = []
    if args.dataset:
        rng = random.Random(args.seed)
        ok = total = 0
        print(f"== Dataset R3P0: {args.dataset} fotos por raza ==")
        for folder, breed in zip(M.R3P0_FOLDERS, M.BREEDS):
            imgs = sorted((R3P0 / folder).glob("*.jpg"))
            hits = 0
            for p in rng.sample(imgs, min(args.dataset, len(imgs))):
                d = describe(args.url, p)
                hit = d["is_dog"] and d["breed"] == breed
                hits += hit; ok += hit; total += 1
                rows.append({"archivo": str(p), "esperado": breed, "acierto": hit, "resultado": summary(d)})
                if not hit:
                    print(f"   x {p.name}: esperado {breed} -> {summary(d)}")
            print(f"{breed:34s} {hits}/{min(args.dataset, len(imgs))}")
        print(f"\nACIERTO RAZA (dataset): {ok}/{total} = {ok / max(1, total) * 100:.1f}%\n")

    files = collect(args.paths)
    if files:
        print(f"== {len(files)} imagenes ==")
    for p in files:
        try:
            d = describe(args.url, p)
            res = summary(d)
        except Exception as exc:  # noqa: BLE001
            res = f"ERROR: {exc}"
        rows.append({"archivo": str(p), "esperado": "", "acierto": "", "resultado": res})
        print(f"{p.name[:40]:40s} {res}")

    if args.csv and rows:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["archivo", "esperado", "acierto", "resultado"])
            w.writeheader(); w.writerows(rows)
        print(f"\nDetalle -> {args.csv}")


if __name__ == "__main__":
    main()
