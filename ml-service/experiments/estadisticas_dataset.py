"""Estadisticas exactas de los datos de entrenamiento (para el documento).

Cuenta, por fuente / clase / split, las fotos de los manifiestos de imagesDS/_v2cache
(los mismos que usan train_v2.py y train_age_e2e.py) y mide la calidad de las fotos
ORIGINALES (resolucion, peso del archivo, nitidez) con una muestra por fuente.

Uso: python experiments/estadisticas_dataset.py  -> experiments/estadisticas_dataset.json
"""
import csv
import json
import random
import sys
import zipfile
import io
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "experiments"))
import v2_meta as M  # noqa: E402

DS = ROOT.parent / "imagesDS"
CACHE = DS / "_v2cache"
OUT = ROOT / "experiments" / "estadisticas_dataset.json"
SAMPLE = 400


def sharp(img):
    g = np.asarray(img.convert("L").resize((224, 224)), dtype=np.float32)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var())


def quality(paths, opener=None):
    random.Random(0).shuffle(paths)
    w, h, kb, sh = [], [], [], []
    for p in paths[:SAMPLE]:
        try:
            data = opener(p) if opener else Path(p).read_bytes()
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception:  # noqa: BLE001
            continue
        w.append(im.width); h.append(im.height); kb.append(len(data) / 1024); sh.append(sharp(im))
    if not w:
        return None
    mp = np.array(w) * np.array(h) / 1e6
    side = np.minimum(w, h)
    return {"muestra": len(w), "ancho_mediana": int(np.median(w)), "alto_mediana": int(np.median(h)),
            "lado_menor_min": int(side.min()), "lado_menor_p10": int(np.percentile(side, 10)),
            "lado_menor_mediana": int(np.median(side)), "lado_menor_max": int(side.max()),
            "megapixeles_mediana": round(float(np.median(mp)), 3),
            "kb_mediana": round(float(np.median(kb)), 1), "kb_max": round(float(np.max(kb)), 1),
            "pct_menores_224px": round(float((side < 224).mean()) * 100, 1),
            "nitidez_mediana": round(float(np.median(sh)), 1)}


def main():
    res = {"manifiestos": {}, "por_clase_split": {}, "calidad_originales": {}}
    rows = []
    for f in sorted(CACHE.glob("manifest_*.csv")):
        with open(f, encoding="utf-8") as fh:
            rows += list(csv.DictReader(fh))
    by_src = defaultdict(Counter)
    cls = defaultdict(Counter)
    for r in rows:
        by_src[r["source"]][r["split"]] += 1
        c = int(r["cls"])
        name = M.CLASSES[c] if c >= 0 else ("perro (solo edad)" if int(r["age"]) >= 0 else "?")
        cls[name][r["split"]] += 1
    res["manifiestos"] = {s: dict(c) | {"total": sum(c.values())} for s, c in sorted(by_src.items())}
    res["por_clase_split"] = {k: dict(v) | {"total": sum(v.values())} for k, v in cls.items()}
    res["total_entrenamiento_dognet_v2"] = len(rows)
    with open(CACHE / "age_manifest.csv", encoding="utf-8") as fh:
        age = list(csv.DictReader(fh))
    res["edad"] = {f"{s}|{g}|{sp}": n for (s, g, sp), n in
                   sorted(Counter((r["source"], r["group"], r["split"]) for r in age).items())}
    res["edad_total"] = len(age)

    def files(folder, pat="*.jpg"):
        return [str(p) for p in Path(folder).rglob(pat)]

    q = res["calidad_originales"]
    q["R3P0 (20 razas)"] = quality(files(DS / "R3P0"))
    q["Stanford Dogs (otras razas)"] = quality(files(DS / "images" / "Images"))
    q["Oxford-IIIT Pets"] = quality(files(DS / "_downloads" / "oxford_pets", "*.jpg"))
    q["Caltech-256"] = quality(files(DS / "_downloads" / "caltech256", "*.jpg"))
    q["COCO 2017 (no perro)"] = quality(files(DS / "_downloads" / "coco_train2017"))
    q["DogAge (Expert + PetFinder)"] = quality(files(DS / "archive" / "Expert_Train") + files(DS / "archive" / "PetFinder_All"))
    zips = sorted((DS / "_downloads" / "petfinder_my").glob("images-*.zip"))
    if zips:
        z = zipfile.ZipFile(zips[0])
        q["PetFinder.my (edad en meses)"] = quality([n for n in z.namelist() if n.lower().endswith(".jpg")],
                                                    opener=lambda n: z.read(n))
    q["Open Images (cachorro si/no, recortes)"] = quality(files(CACHE / "openimages"))
    q["MPDD (re-identificacion, pruebas)"] = quality(files(DS / "MPDD" / "MPDD" / "pytorch"))
    OUT.write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(res, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
