"""Agrega a age_manifest.csv fotos de Open Images V7 con la etiqueta "Puppy"
verificada por personas (cachorro SI / cachorro NO), para el estimador de edad.

Por que: PetFinder.my (Malasia) y DogAge traen sobre todo mestizos de refugio; los
cachorros de raza fotografiados en casa (lo que suben los usuarios) casi no estan.
Open Images trae fotos variadas de internet y, para la etiqueta "Puppy" (/m/0d7s3w),
anotadores humanos confirmaron si hay o no un cachorro en la foto:
  Puppy = 1                -> cachorro      (0 - 12.5 meses)
  Puppy = 0 y Dog (/m/0bt9lr) = 1 -> perro que NO es cachorro (12.5+ meses)

Solo se usan fotos con UNA caja de perro (no de grupo) y se recorta esa caja con
margen: si hay varios perros no se sabe cual es el cachorro.

El split "test" de Open Images queda SIEMPRE fuera del entrenamiento (split=test en
el manifiesto): es la prueba con fotos ajenas a los datasets de entrenamiento.

Entradas (imagesDS/_downloads/openimages/, filtradas con grep de los CSV oficiales):
  labels_{train,val,test}.csv  <- oidv7-*-annotations-human-imagelabels.csv (Dog/Puppy)
  bbox_{train,val,test}.csv    <- *-annotations-bbox.csv (solo /m/0bt9lr)
Las imagenes se descargan del bucket publico open-images-dataset (S3, sin cuenta).

Uso:
  python experiments/prepare_age.py               # primero (reescribe el manifiesto)
  python experiments/prepare_age_openimages.py    # despues (agrega filas openimages)
"""
import csv
import io
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
DS = ROOT.parent / "imagesDS"
SRC = DS / "_downloads" / "openimages"
CACHE = DS / "_v2cache"
OUT_DIR = CACHE / "openimages"
MANIFEST = CACHE / "age_manifest.csv"
PUPPY, DOG = "/m/0d7s3w", "/m/0bt9lr"
URL = "https://open-images-dataset.s3.amazonaws.com/{folder}/{id}.jpg"
FOLDER = {"train": "train", "val": "validation", "test": "test"}
SHORT_SIDE = 256
PAD = 0.15                     # margen alrededor de la caja del perro
MIN_BOX_PX = 64                # cajas mas chicas no tienen detalle para la edad
PUPPY_RANGE, ADULT_RANGE = (0.0, 12.5), (12.5, 240.0)


def read_labels(split):
    lab = defaultdict(dict)
    with open(SRC / f"labels_{split}.csv", encoding="utf-8") as fh:
        for r in csv.reader(fh):
            lab[r[0]][r[2]] = float(r[3])
    return lab


def read_boxes(split):
    boxes = defaultdict(list)
    path = SRC / f"bbox_{split}.csv"
    with open(path, encoding="utf-8") as fh:
        for r in csv.reader(fh):
            if r[0] == "ImageID" or r[2] != DOG:
                continue
            boxes[r[0]].append({"box": tuple(map(float, r[4:8])), "group": r[10] == "1"})
    return boxes


def crop_and_save(img_id, split, box):
    dst = OUT_DIR / f"{img_id}.jpg"
    if dst.exists():
        return True
    try:
        with urllib.request.urlopen(URL.format(folder=FOLDER[split], id=img_id), timeout=30) as r:
            data = r.read()
        img = Image.open(io.BytesIO(data))
        img.load()
        img = img.convert("RGB")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {img_id}: {exc}")
        return False
    w, h = img.size
    x0, x1, y0, y1 = box
    bw, bh = (x1 - x0) * w, (y1 - y0) * h
    if min(bw, bh) < MIN_BOX_PX:
        return False
    px, py = bw * PAD, bh * PAD
    img = img.crop((max(0, x0 * w - px), max(0, y0 * h - py), min(w, x1 * w + px), min(h, y1 * h + py)))
    s = SHORT_SIDE / min(img.size)
    if s < 1:
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.BICUBIC)
    img.save(dst, "JPEG", quality=90)
    return True


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    jobs = []
    for split in ("train", "val", "test"):
        labels, boxes = read_labels(split), read_boxes(split)
        stats = Counter()
        for img_id, lab in labels.items():
            if lab.get(PUPPY) == 1:
                kind = "cachorro"
            elif lab.get(PUPPY) == 0 and lab.get(DOG) == 1:
                kind = "no_cachorro"
            else:
                continue
            b = boxes.get(img_id, [])
            if len(b) != 1 or b[0]["group"]:
                stats[f"{kind}: sin caja unica"] += 1
                continue
            stats[kind] += 1
            jobs.append((img_id, split, b[0]["box"], kind))
        print(f"[{split}] {dict(stats)}")

    def work(job):
        return job, crop_and_save(job[0], job[1], job[2])

    with ThreadPoolExecutor(16) as ex:
        done = [j for j, ok in ex.map(work, jobs) if ok]
    print(f"Descargadas/recortadas: {len(done)} de {len(jobs)}")

    with open(MANIFEST, encoding="utf-8") as fh:
        rows = [r for r in csv.DictReader(fh) if r["source"] != "openimages"]
    for img_id, split, _, kind in done:
        lo, hi = PUPPY_RANGE if kind == "cachorro" else ADULT_RANGE
        rows.append({"path": f"openimages/{img_id}.jpg", "source": "openimages", "lo": lo, "hi": hi,
                     "group": kind, "split": "test" if split == "test" else "train"})
    with open(MANIFEST, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "source", "lo", "hi", "group", "split"])
        w.writeheader()
        w.writerows(rows)
    print(f"-> {MANIFEST}")
    for (grp, split), n in sorted(Counter((r["group"], r["split"]) for r in rows
                                          if r["source"] == "openimages").items()):
        print(f"    {n:6d}  openimages {grp:12s} {split}")


if __name__ == "__main__":
    main()
