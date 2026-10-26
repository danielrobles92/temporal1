"""Complemento de PI-06/07/09/11: las mismas degradaciones aplicadas SOLO a las fotos de
alta calidad del MPDD (lado menor >= 224 px y nitidez >= mediana), buscadas contra todo el MPDD.

python experiments/banco_variantes_alta_calidad.py . experiments/resultados_variantes_alta_calidad.json
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT / "experiments"))
import banco_pruebas as B  # noqa: E402

pipe = B.Pipeline()
recs, imgs = B.load_mpdd()
ids = np.array([r["id"] for r in recs])
E, gates = pipe.embed(imgs)
d0 = pipe.describe(imgs, gates)
sizes = np.array([min(im.size) for im in imgs])
sh = np.array([B.sharpness(im) for im in imgs])
hq = (sizes >= 224) & (sh >= np.median(sh))
idx = np.where(hq)[0]
loo = B.loo_exclude(len(imgs))[hq]
base = B.ranking((E @ E.T)[hq], ids[hq], ids, loo)
base["aceptadas_como_perro"] = float(np.mean([d0[i]["is_dog"] for i in idx]))
out = {"fotos_alta_calidad": int(hq.sum()), "original": base, "variantes": {}}
for name, (grp, fn) in B.make_variants().items():
    r2 = np.random.default_rng(1)
    v = [fn(imgs[i], r2) for i in idx]
    V, vg = pipe.embed(v)
    vd = pipe.describe(v, vg)
    r = B.ranking(V @ E.T, ids[hq], ids, loo)
    r["aceptadas_como_perro"] = float(np.mean([d["is_dog"] for d in vd]))
    r["caida_top1_pts"] = round((base["top1"] - r["top1"]) * 100, 1)
    out["variantes"][name] = {"prueba": grp, **r}
Path(sys.argv[2]).write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
print(json.dumps(out, indent=1, ensure_ascii=False))
