"""Prepara el dataset de edad en MESES para el estimador de edad (train_age.py).

Fuentes (todas como intervalos de edad en meses, porque ninguna trae la edad exacta):

  petfinder_my  PetFinder.my Adoption Prediction (Kaggle, Malasia), espejo publico de
                MulTaBench en Hugging Face (multabench/core-img-cls-petfinder): una
                foto por mascota y la edad al publicarla agrupada en 8 grupos. Los
                limites se verificaron contra las edades escritas en las descripciones:
                  0-1 | 2 | 3 | 4 | 5-7 | 8-12 | 13-29 | 30+ meses
                Aporta el detalle fino de cachorros (meses).
  dogage        DogAge (ya en imagesDS/_v2cache, ver prepare_v2.py):
                  cachorro 0-2 | adulto 2-6 | senior 6+ anios
                Aporta la separacion adulto / senior.

Descarga (una sola vez, ~414 MB, sin cuenta):
  imagesDS/_downloads/petfinder_my/{data.parquet, images-00000..2.zip}
  https://huggingface.co/datasets/multabench/core-img-cls-petfinder

Salida: imagesDS/_v2cache/petfinder_my/<md5>.jpg y imagesDS/_v2cache/age_manifest.csv
(path, source, lo, hi, group, split). No se llama manifest_*.csv a proposito para que
train_v2.py no lo mezcle con el entrenamiento de raza.

Requiere pyarrow (solo para leer el parquet).

Uso:
  python experiments/prepare_age.py
"""
import csv
import hashlib
import io
import zipfile
from collections import Counter
from pathlib import Path

import pyarrow.parquet as pq
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
DS = ROOT.parent / "imagesDS"
SRC = DS / "_downloads" / "petfinder_my"
CACHE = DS / "_v2cache"
OUT = CACHE / "age_manifest.csv"
SHORT_SIDE = 256
VAL_PERCENT = 20

# Grupo de PetFinder.my -> intervalo de edad real en meses. La edad publicada es un
# entero (o una estimacion redondeada del refugio), de ahi los medios meses.
PETFINDER_BINS = {
    "Quantile 0-12%": (0.0, 1.5),
    "Quantile 12-25%": (1.5, 2.5),
    "Quantile 25-38%": (2.5, 3.5),
    "Quantile 38-50%": (3.5, 4.5),
    "Quantile 50-62%": (4.5, 7.5),
    "Quantile 62-75%": (7.5, 12.5),
    "Quantile 75-88%": (12.5, 29.5),
    "Quantile 88-100%": (29.5, 240.0),
}
# DogAge (Zamansky et al., 2019): young 0-2, adult 2-5/6, senior > 6 anios.
DOGAGE_BINS = {0: (0.0, 24.0), 1: (24.0, 72.0), 2: (72.0, 216.0)}


def split_of(key):
    return "val" if int(hashlib.md5(key.encode()).hexdigest()[:8], 16) % 100 < VAL_PERCENT else "train"


def save_resized(data, dst):
    img = Image.open(io.BytesIO(data))
    img.load()
    img = img.convert("RGB")
    w, h = img.size
    if min(w, h) < 48:
        return False
    s = SHORT_SIDE / min(w, h)
    if s < 1:
        img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BICUBIC)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "JPEG", quality=90)
    return True


def build_petfinder_my():
    table = pq.read_table(SRC / "data.parquet", columns=["Type", "Quantity", "Pet Image", "AGE_BIN"])
    meta = {}
    for t, q, name, b in zip(*(table.column(c).to_pylist() for c in table.column_names)):
        # Solo perros (Type=1) y publicaciones de un solo animal (si no, la foto
        # puede mostrar a la camada completa con edades distintas).
        if t == 1 and q == 1 and b in PETFINDER_BINS:
            meta[name] = b
    rows, seen = [], set()
    for zp in sorted(SRC.glob("images-*.zip")):
        with zipfile.ZipFile(zp) as z:
            for name in z.namelist():
                b = meta.get(name)
                if b is None:
                    continue
                data = z.read(name)
                h = hashlib.md5(data).hexdigest()
                if h in seen:
                    continue
                seen.add(h)
                rel = f"petfinder_my/{h}.jpg"
                try:
                    if not save_resized(data, CACHE / rel):
                        continue
                except Exception as exc:  # noqa: BLE001
                    print(f"  ! {name}: {exc}")
                    continue
                lo, hi = PETFINDER_BINS[b]
                rows.append({"path": rel, "source": "petfinder_my", "lo": lo, "hi": hi,
                             "group": b.replace("Quantile ", "q"), "split": split_of(name)})
    print(f"[petfinder_my] {len(rows)} fotos de perros (de {len(meta)} mascotas con 1 animal)")
    return rows


def build_dogage():
    rows = []
    with open(CACHE / "manifest_dogage.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            age = int(r["age"])
            lo, hi = DOGAGE_BINS[age]
            origin = "expert" if "/expert/" in r["path"] else "petfinder"
            rows.append({"path": r["path"], "source": f"dogage_{origin}", "lo": lo, "hi": hi,
                         "group": ["cachorro", "adulto", "senior"][age], "split": r["split"]})
    print(f"[dogage] {len(rows)} fotos")
    return rows


def main():
    if not (SRC / "data.parquet").exists():
        raise SystemExit(f"Falta {SRC}/data.parquet (ver la docstring para descargarlo).")
    rows = build_petfinder_my() + build_dogage()
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "source", "lo", "hi", "group", "split"])
        w.writeheader()
        w.writerows(rows)
    print(f"-> {OUT}")
    for (src, grp, split), n in sorted(Counter((r["source"], r["group"], r["split"]) for r in rows).items()):
        print(f"    {n:6d}  {src:18s} {grp:12s} {split}")


if __name__ == "__main__":
    main()
