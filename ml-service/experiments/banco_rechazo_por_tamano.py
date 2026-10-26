"""Perros del MPDD rechazados como "no perro", segun el tamano de la foto (lado menor).

Ejecutar con el python del ml-service: python experiments/banco_rechazo_por_tamano.py . experiments/resultados_rechazo_por_tamano.json
"""
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT))
from app.analyzer import DogAnalyzer  # noqa: E402
from app.model import EfficientNetEmbedder  # noqa: E402

MPDD = ROOT.parent / "imagesDS" / "MPDD" / "MPDD" / "pytorch"
dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
emb = EfficientNetEmbedder(device=str(dev))
an = DogAnalyzer(ROOT / "models/dognet_v2.pt", dev, ROOT / "models/dognet_v2_thresholds.json", with_color=False)
files = sorted(p for fo in ("train", "val", "query", "gallery") for p in (MPDD / fo).glob("*.jpg"))
side, dog, typ = [], [], []
for i in range(0, len(files), 64):
    ims = [Image.open(p).convert("RGB") for p in files[i:i + 64]]
    _, g = emb.analyze_images(ims)
    for im, d in zip(ims, an.describe(ims, g)):
        side.append(min(im.size))
        dog.append(d["is_dog"])
        typ.append(d["not_dog_type"])
side, dog = np.array(side), np.array(dog)
bins = [(0, 64), (64, 100), (100, 150), (150, 224), (224, 10_000)]
out = {"total": len(files), "rechazadas": int((~dog).sum()), "tasa": float((~dog).mean()),
       "tipo_rechazo": Counter(t for t, d in zip(typ, dog) if not d).most_common(),
       "por_lado_menor": [{"rango_px": f"{a}-{b - 1}" if b < 10_000 else f">= {a}", "n": int(((side >= a) & (side < b)).sum()),
                           "rechazo": float((~dog[(side >= a) & (side < b)]).mean()) if ((side >= a) & (side < b)).any() else None}
                          for a, b in bins]}
Path(sys.argv[2]).write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
print(json.dumps(out, indent=1, ensure_ascii=False))
