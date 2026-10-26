"""Prepara los datos del modelo v2: cache redimensionada + manifiesto CSV.

Cada fuente se convierte en imagenes JPEG con el lado corto a 256 px (carga
rapida durante el entrenamiento) bajo imagesDS/_v2cache/<fuente>/ y un manifiesto
imagesDS/_v2cache/manifest_<fuente>.csv con columnas:

  path, source, cls, size, age, md5, split

  cls  : indice en v2_meta.CLASSES (raza 0..19, Otro 20, no-perro 21..24) o -1
         si solo se sabe que ES un perro (DogAge: raza desconocida).
  size : 0/1/2 (pequeno/mediano/grande) o -1 si no se conoce.
  age  : 0/1/2 (cachorro/adulto/senior) o -1.
  split: train | val (por hash del archivo, estable entre corridas).

Fuentes (en orden de prioridad para deduplicar por MD5):
  r3p0      imagesDS/R3P0                    -> 20 razas
  oxford    Oxford-IIIT Pet                  -> 8 razas de las 20, Otro, gatos
  stanford  Stanford Dogs (las otras 100)    -> Otro, canidos salvajes
  archive   Dog Breeds Image Dataset         -> Otro (mestizos y razas extra)
  caltech   Caltech-256                      -> peluche, animales, objetos
  coco      COCO train2017 (recortes)        -> gato, peluche, animales, personas, escenas
  dogage    DogAge (Kaggle)                  -> edad (cachorro/adulto/senior)

Uso:
  python experiments/prepare_v2.py --sources r3p0 oxford stanford archive caltech coco
  python experiments/prepare_v2.py --sources dogage          # cuando este descargado
"""
import argparse
import csv
import hashlib
import io
import json
import random
import tarfile
import urllib.request
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Pool
from pathlib import Path

from PIL import Image, ImageFile

import v2_meta as M

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
DS = ROOT.parent / "imagesDS"
DL = DS / "_downloads"
CACHE = DS / "_v2cache"
SHORT_SIDE = 256
VAL_PERCENT = 12
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
DOG_SOURCES = ["r3p0", "oxford", "stanford", "archive", "dogage"]

random.seed(1234)


def md5_file(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def split_of(key):
    return "val" if int(key[:8], 16) % 100 < VAL_PERCENT else "train"


def list_images(folder):
    return sorted(p for p in Path(folder).rglob("*") if p.suffix.lower() in IMG_EXT)


# --------------------------------------------------------------------------- jobs
# job = dict(src, box|None, dst, cls, size, age, md5, split)

def process(job):
    """Abre, recorta (opcional), redimensiona y guarda. Devuelve la fila o None."""
    try:
        img = Image.open(job["src"])
        img.load()
        img = img.convert("RGB")
        if job.get("box"):
            img = img.crop(job["box"])
        w, h = img.size
        if min(w, h) < 48:
            return None
        s = SHORT_SIDE / min(w, h)
        if s < 1:
            img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BICUBIC)
        dst = CACHE / job["dst"]
        dst.parent.mkdir(parents=True, exist_ok=True)
        img.save(dst, "JPEG", quality=90)
        return {k: job[k] for k in ("cls", "size", "age", "md5", "split")} | {
            "path": job["dst"].replace("\\", "/"), "source": job["source"]}
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {job['src']}: {exc}")
        return None


def run_jobs(source, jobs, workers):
    print(f"[{source}] procesando {len(jobs)} imagenes ...", flush=True)
    with Pool(workers) as pool:
        rows = [r for r in pool.imap_unordered(process, jobs, chunksize=16) if r]
    rows.sort(key=lambda r: r["path"])
    out = CACHE / f"manifest_{source}.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "source", "cls", "size", "age", "md5", "split"])
        w.writeheader()
        w.writerows(rows)
    summary = Counter((M.CLASSES[r["cls"]] if r["cls"] >= 0 else "perro(sin raza)") for r in rows)
    print(f"[{source}] {len(rows)} filas -> {out.name}")
    for k, v in sorted(summary.items(), key=lambda kv: -kv[1])[:30]:
        print(f"    {v:6d}  {k}")
    return rows


def known_md5(exclude_source):
    seen = set()
    for s in DOG_SOURCES:
        if s == exclude_source:
            continue
        f = CACHE / f"manifest_{s}.csv"
        if f.exists():
            with open(f, encoding="utf-8") as fh:
                seen.update(r["md5"] for r in csv.DictReader(fh))
    return seen


def make_job(source, src, dst, cls, size, age, md5, box=None, split_key=None):
    return {"source": source, "src": str(src), "dst": dst, "cls": cls,
            "size": M.SIZE_IDX[size] if isinstance(size, str) else (-1 if size is None else size),
            "age": age, "md5": md5, "box": box, "split": split_of(split_key or md5)}


# ------------------------------------------------------------------------ sources

def build_r3p0():
    jobs = []
    for idx, folder in enumerate(M.R3P0_FOLDERS):
        for p in list_images(DS / "R3P0" / folder):
            h = md5_file(p)
            jobs.append(make_job("r3p0", p, f"r3p0/{folder}/{p.stem}.jpg", idx,
                                 M.r3p0_size(folder, p.name), -1, h))
    return jobs


def build_stanford(seen):
    jobs = []
    for d in sorted((DS / "images" / "Images").iterdir()):
        name = M.norm(d.name)
        if name in M.STANFORD_IN_R3P0 or name in M.STANFORD_EXCLUDE:
            continue
        if name in M.STANFORD_WILD:
            cls, size = M.IDX_NOT_DOG + M.NOT_DOG.index("animal"), None
        elif name in M.STANFORD_OTRO_SIZE:
            cls, size = M.IDX_OTRO, M.STANFORD_OTRO_SIZE[name]
        else:
            raise KeyError(f"Raza de Stanford sin mapear: {d.name}")
        for p in list_images(d):
            h = md5_file(p)
            if h in seen:
                continue
            seen.add(h)
            jobs.append(make_job("stanford", p, f"stanford/{d.name}/{p.stem}.jpg", cls, size, -1, h))
    return jobs


def build_archive(seen):
    jobs = []
    root = DS / "archive" / "Dog Breeds Image Dataset"
    for d in sorted(root.iterdir()):
        name = M.norm(d.name)
        if name in M.ARCHIVE_WILD:
            cls, size = M.IDX_NOT_DOG + M.NOT_DOG.index("animal"), None
        elif name in M.ARCHIVE_OTRO_SIZE:
            cls, size = M.IDX_OTRO, M.ARCHIVE_OTRO_SIZE[name]
        else:
            continue  # una de las 20 (ya en R3P0) o excluida
        for p in list_images(d):
            h = md5_file(p)
            if h in seen:
                continue
            seen.add(h)
            jobs.append(make_job("archive", p, f"archive/{d.name}/{p.stem}.jpg", cls, size, -1, h))
    return jobs


def build_oxford(seen):
    img_dir = DL / "oxford_pets" / "images"
    if not img_dir.exists():
        tgz = DL / "oxford_pets_images.tar.gz"
        print(f"  extrayendo {tgz.name} ...")
        with tarfile.open(tgz) as t:
            t.extractall(DL / "oxford_pets")
    jobs = []
    for p in list_images(img_dir):
        breed_raw = p.stem.rsplit("_", 1)[0]
        name = M.norm(breed_raw)
        is_cat = breed_raw[:1].isupper()   # en Oxford los gatos van con mayuscula
        if is_cat:
            cls, size = M.IDX_NOT_DOG + M.NOT_DOG.index("gato"), None
        elif name in M.OXFORD_TO_BREED:
            cls, size = M.BREEDS.index(M.OXFORD_TO_BREED[name]), M.OXFORD_SIZE_OF_BREED[name]
        elif name in M.OXFORD_OTRO_SIZE:
            cls, size = M.IDX_OTRO, M.OXFORD_OTRO_SIZE[name]
        elif name in M.OXFORD_EXCLUDE:
            continue
        else:
            raise KeyError(f"Raza de Oxford sin mapear: {breed_raw}")
        h = md5_file(p)
        if h in seen:
            continue
        seen.add(h)
        jobs.append(make_job("oxford", p, f"oxford/{breed_raw}/{p.stem}.jpg", cls, size, -1, h))
    return jobs


# Caltech-256: categorias de animales (no perro). 'dog' se excluye.
CALTECH_ANIMALS = {
    "bat", "bear", "butterfly", "camel", "centipede", "chimp", "cockroach", "conch",
    "crab-101", "duck", "elephant-101", "elk", "frog", "giraffe", "goat", "goldfish",
    "goose", "gorilla", "grasshopper", "hawksbill-101", "hermit-crab", "horse",
    "horseshoe-crab", "house-fly", "hummingbird", "ibis-101", "iguana", "kangaroo-101",
    "killer-whale", "leopards-101", "llama-101", "mussels", "octopus", "ostrich", "owl",
    "penguin", "porcupine", "raccoon", "scorpion-101", "skunk", "snail", "snake", "spider",
    "starfish-101", "swan", "toad", "triceratops", "zebra", "cormorant", "dolphin-101",
    "mallard", "praying-mantis", "teddy-bear",
}
CALTECH_EXCLUDE = {"dog", "greyhound"}   # greyhound = galgo (perro)
CALTECH_OBJECT_CAP = 30


def build_caltech():
    root = DL / "caltech256" / "256_ObjectCategories"
    if not root.exists():
        print("  extrayendo caltech256.tar ...")
        with tarfile.open(DL / "caltech256.tar") as t:
            t.extractall(DL / "caltech256")
    jobs = []
    rng = random.Random(7)
    for d in sorted(root.iterdir()):
        if not d.is_dir():
            continue
        cat = d.name.split(".", 1)[1]
        if cat in CALTECH_EXCLUDE:
            continue
        if cat == "teddy-bear":
            kind = "peluche"
        elif cat in CALTECH_ANIMALS:
            kind = "animal"
        else:
            kind = "objeto"
        imgs = list_images(d)
        if kind == "objeto" and len(imgs) > CALTECH_OBJECT_CAP:
            imgs = rng.sample(imgs, CALTECH_OBJECT_CAP)
        for p in imgs:
            h = md5_file(p)
            jobs.append(make_job("caltech", p, f"caltech/{d.name}/{p.stem}.jpg",
                                 M.IDX_NOT_DOG + M.NOT_DOG.index(kind), None, -1, h))
    return jobs


# COCO train2017: recortes por instancia (sin imagenes que contengan perros).
COCO_CAT, COCO_DOG, COCO_TEDDY, COCO_PERSON = 17, 18, 88, 1
COCO_ANIMALS = {16: "bird", 19: "horse", 20: "sheep", 21: "cow", 22: "elephant",
                23: "bear", 24: "zebra", 25: "giraffe"}
COCO_CAPS = {"gato": 2500, "peluche": 2500, "animal_each": 300, "persona": 800, "escena": 1000}


def _coco_download(file_names, dst_dir, workers=24):
    dst_dir.mkdir(parents=True, exist_ok=True)

    def get(fn):
        out = dst_dir / fn
        if out.exists() and out.stat().st_size > 0:
            return True
        for _ in range(3):
            try:
                urllib.request.urlretrieve(f"http://images.cocodataset.org/train2017/{fn}", out)
                return True
            except Exception:  # noqa: BLE001
                continue
        return False

    with ThreadPoolExecutor(workers) as ex:
        ok = sum(ex.map(get, file_names))
    print(f"  COCO: {ok}/{len(file_names)} imagenes descargadas en {dst_dir}")


def build_coco():
    zpath = DL / "coco_annotations_trainval2017.zip"
    with zipfile.ZipFile(zpath) as z:
        data = json.loads(z.read("annotations/instances_train2017.json"))
    images = {im["id"]: im for im in data["images"]}
    by_img = defaultdict(list)
    for a in data["annotations"]:
        by_img[a["image_id"]].append(a)
    del data

    rng = random.Random(11)
    animal_ids = set(COCO_ANIMALS) | {COCO_CAT, COCO_TEDDY}
    picks = defaultdict(list)   # kind -> [(image, box)]
    for img_id, anns in by_img.items():
        cats = {a["category_id"] for a in anns}
        if COCO_DOG in cats:
            continue
        im = images[img_id]
        W, H = im["width"], im["height"]
        for a in anns:
            if a.get("iscrowd"):
                continue
            x, y, w, h = a["bbox"]
            if min(w, h) < 96 or (w * h) / (W * H) < 0.04:
                continue
            c = a["category_id"]
            if c == COCO_CAT:
                kind = "gato"
            elif c == COCO_TEDDY:
                kind = "peluche"
            elif c in COCO_ANIMALS:
                kind = "animal:" + COCO_ANIMALS[c]
            elif c == COCO_PERSON:
                kind = "persona"
            else:
                continue
            px, py = w * 0.10, h * 0.10
            box = (max(0, x - px), max(0, y - py), min(W, x + w + px), min(H, y + h + py))
            picks[kind].append((im, tuple(round(v) for v in box)))
    # escenas completas sin animales (objetos, interiores, calles)
    no_animal = [images[i] for i, anns in by_img.items()
                 if not ({a["category_id"] for a in anns} & (animal_ids | {COCO_DOG}))]
    picks["escena"] = [(im, None) for im in rng.sample(no_animal, COCO_CAPS["escena"])]

    selected = []
    for kind, items in picks.items():
        rng.shuffle(items)
        cap = COCO_CAPS["animal_each"] if kind.startswith("animal:") else COCO_CAPS[kind]
        selected += [(kind, im, box) for im, box in items[:cap]]

    dst_dir = DL / "coco_train2017"
    _coco_download(sorted({im["file_name"] for _, im, _ in selected}), dst_dir)

    jobs = []
    for n, (kind, im, box) in enumerate(selected):
        src = dst_dir / im["file_name"]
        if not src.exists():
            continue
        target = {"gato": "gato", "peluche": "peluche", "persona": "objeto",
                  "escena": "objeto"}.get(kind, "animal")
        key = hashlib.md5(im["file_name"].encode()).hexdigest()   # mismo split por imagen
        tag = kind.replace(":", "_")
        jobs.append(make_job("coco", src, f"coco/{tag}/{Path(im['file_name']).stem}_{n}.jpg",
                             M.IDX_NOT_DOG + M.NOT_DOG.index(target), None, -1,
                             hashlib.md5(f"{im['file_name']}{box}".encode()).hexdigest(),
                             box=box, split_key=key))
    return jobs


AGE_WORDS = {"young": 0, "adult": 1, "senior": 2}


DOGAGE_ROOTS = [DS / "archive" / "Expert_Train", DS / "archive" / "PetFinder_All", DS / "DogAge"]


def build_dogage(seen):
    """DogAge: Expert (edad verificada) -> split val; PetFinder -> train/val por mascota.

    Asi la precision de edad de la corrida de validacion se mide sobre fotos de
    expertos que el modelo nunca vio. El modelo final (--all-data) usa todo.
    """
    roots = [r for r in DOGAGE_ROOTS if r.exists()]
    if not roots:
        raise SystemExit("No se encontro DogAge (imagesDS/archive/Expert_Train, PetFinder_All).")
    jobs = []
    for root in roots:
        for p in list_images(root):
            parts = [x.lower() for x in p.relative_to(root.parent).parts[:-1]]
            age = next((AGE_WORDS[w] for part in reversed(parts) for w in AGE_WORDS if part == w), None)
            if age is None:
                continue
            h = md5_file(p)
            if h in seen:
                continue
            seen.add(h)
            origin = "expert" if any("expert" in x for x in parts) else "petfinder"
            # PetFinder nombra <id_mascota>_<n>.jpg: todas las fotos de una mascota
            # caen en el mismo split (evita fuga entre train y val).
            pet_key = hashlib.md5(p.stem.split("_")[0].encode()).hexdigest()
            job = make_job("dogage", p, f"dogage/{origin}/{M.AGES[age]}/{h}.jpg", -1, None, age, h,
                           split_key=pet_key)
            if origin == "expert":
                job["split"] = "val"
            jobs.append(job)
    return jobs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", nargs="+", required=True,
                    choices=["r3p0", "oxford", "stanford", "archive", "caltech", "coco", "dogage"])
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)

    for source in args.sources:
        if source == "r3p0":
            jobs = build_r3p0()
        elif source in ("oxford", "stanford", "archive", "dogage"):
            seen = known_md5(source)
            jobs = {"oxford": build_oxford, "stanford": build_stanford,
                    "archive": build_archive, "dogage": build_dogage}[source](seen)
        elif source == "caltech":
            jobs = build_caltech()
        else:
            jobs = build_coco()
        run_jobs(source, jobs, args.workers)


if __name__ == "__main__":
    main()
