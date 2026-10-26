"""Descarga las fotos de COCO que usa el banco de pruebas (banco_pruebas.py) para
las entradas invalidas y las fotos con varios perros.

Todas son fotos AJENAS al entrenamiento: DogNet v2 solo uso fotos de COCO train2017
de gatos, peluches, personas, escenas y 8 animales (manifest_coco.csv); aqui se toman
fotos de val2017 (nunca usadas) y, para "varios perros", fotos de perros de train2017
(ninguna foto con perro de COCO se uso para entrenar).

  otros_animales  val2017: gato, ave, caballo, oveja, vaca, elefante, oso, cebra, jirafa
                  (sin perro, el animal ocupa >= 10 % de la foto)
  sin_animales    val2017: personas y escenas sin ningun animal ni peluche
  objetos         val2017: peluches (teddy bear) y sillas, sin animales, >= 10 % de la foto
  varios_perros   train2017 + val2017: 2 a 4 perros, cada uno >= 4 % de la foto

Salida: imagesDS/_downloads/coco_pruebas/<grupo>/<id>.jpg y coco_pruebas.json
(cajas de los perros en "varios_perros").

Uso: python experiments/prepare_pruebas_coco.py
"""
import json
import random
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DS = ROOT.parent / "imagesDS" / "_downloads"
ANN = DS / "coco_ann" / "annotations"          # extraido de coco_annotations_trainval2017.zip
OUT = DS / "coco_pruebas"
URL = "http://images.cocodataset.org/{split}/{file}"
ANIMALS = {16: "ave", 17: "gato", 19: "caballo", 20: "oveja", 21: "vaca", 22: "elefante",
           23: "oso", 24: "cebra", 25: "jirafa"}
DOG, TEDDY, CHAIR, PERSON = 18, 88, 62, 1
PER_ANIMAL = 60
random.seed(7)


def load(split):
    d = json.loads((ANN / f"instances_{split}.json").read_text(encoding="utf-8"))
    imgs = {i["id"]: i for i in d["images"]}
    anns = defaultdict(list)
    for a in d["annotations"]:
        im = imgs[a["image_id"]]
        anns[a["image_id"]].append((a["category_id"], a["area"] / (im["width"] * im["height"]), a["bbox"],
                                    a.get("iscrowd", 0)))
    return imgs, anns


def main():
    jobs, meta = [], {"varios_perros": {}}
    imgs, anns = load("val2017")
    cats_of = {i: {c for c, *_ in a} for i, a in anns.items()}
    any_animal = set(ANIMALS) | {DOG, TEDDY}

    for cat, name in ANIMALS.items():
        ids = [i for i, a in anns.items() if DOG not in cats_of[i]
               and max((ar for c, ar, *_ in a if c == cat), default=0) >= 0.10]
        for i in random.sample(ids, min(PER_ANIMAL, len(ids))):
            jobs.append(("val2017", imgs[i]["file_name"], f"otros_animales/{name}"))

    no_animal = [i for i in imgs if not (cats_of.get(i, set()) & any_animal)]
    people = [i for i in no_animal if PERSON in cats_of.get(i, set())]
    scenes = [i for i in no_animal if PERSON not in cats_of.get(i, set())]
    for i in random.sample(people, 150):
        jobs.append(("val2017", imgs[i]["file_name"], "sin_animales/personas"))
    for i in random.sample(scenes, 150):
        jobs.append(("val2017", imgs[i]["file_name"], "sin_animales/escenas"))

    for cat, name, n in [(TEDDY, "peluche", 90), (CHAIR, "silla", 90)]:
        ids = [i for i, a in anns.items() if not (cats_of[i] & (set(ANIMALS) | {DOG}))
               and max((ar for c, ar, *_ in a if c == cat), default=0) >= 0.10]
        for i in random.sample(ids, min(n, len(ids))):
            jobs.append(("val2017", imgs[i]["file_name"], f"objetos/{name}"))

    for split in ("val2017", "train2017"):
        if split == "train2017":
            imgs, anns = load("train2017")
        for i, a in anns.items():
            dogs = [(ar, box) for c, ar, box, crowd in a if c == DOG and not crowd]
            if 2 <= len(dogs) <= 4 and min(ar for ar, _ in dogs) >= 0.04 and not any(
                    c == DOG and crowd for c, _, _, crowd in a):
                meta["varios_perros"][imgs[i]["file_name"]] = {
                    "split": split, "boxes": [box for _, box in sorted(dogs, reverse=True)],
                    "size": [imgs[i]["width"], imgs[i]["height"]]}
    keep = random.sample(sorted(meta["varios_perros"]), min(200, len(meta["varios_perros"])))
    meta["varios_perros"] = {k: meta["varios_perros"][k] for k in keep}
    for f, m in meta["varios_perros"].items():
        jobs.append((m["split"], f, "varios_perros"))

    def get(job):
        split, file, group = job
        dst = OUT / group / file
        if dst.exists():
            return True
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urllib.request.urlopen(URL.format(split=split, file=file), timeout=30) as r:
                dst.write_bytes(r.read())
            return True
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {file}: {exc}")
            return False

    with ThreadPoolExecutor(16) as ex:
        ok = sum(ex.map(get, jobs))
    (OUT / "coco_pruebas.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"{ok} de {len(jobs)} fotos en {OUT}")
    counts = defaultdict(int)
    for _, _, g in jobs:
        counts[g] += 1
    for g, n in sorted(counts.items()):
        print(f"  {n:4d}  {g}")


if __name__ == "__main__":
    main()
