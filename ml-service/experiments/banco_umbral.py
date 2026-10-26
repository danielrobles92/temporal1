"""PI-17: compromiso del umbral de coseno entre
  - encontrar al perro correcto con etiqueta >= "Posible" (1.er candidato correcto y coseno >= t), y
  - falsa alarma con un perro SIN registro (su mejor candidato, otro perro, llega a t).
Se barre t en MPDD train/val (cada foto busca contra las demas, sin ella misma) y el umbral
que deja la falsa alarma <= 10 % se comprueba en MPDD prueba (consulta vs galeria).

python experiments/banco_umbral.py . experiments/resultados_umbral.json
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
part = np.array([r["part"] for r in recs])
E, _ = pipe.embed(imgs)


def stats(Sq, qid, gid, self_mask=None):
    S = Sq.copy()
    if self_mask is not None:
        S[self_mask] = -np.inf
    j = S.argmax(1)
    best = S[np.arange(len(S)), j]
    top1_ok = gid[j] == qid
    S2 = S.copy()
    S2[gid[None, :] == qid[:, None]] = -np.inf          # el perro "no esta registrado"
    imp = S2.max(1)
    return best, top1_ok, imp


dev = part == "dev"
Sd = E[dev] @ E[dev].T
bd, okd, impd = stats(Sd, ids[dev], ids[dev], np.eye(int(dev.sum()), dtype=bool))
q, g = part == "query", part == "gallery"
bt, okt, impt = stats(E[q] @ E[g].T, ids[q], ids[g])

rows = []
for t in np.round(np.arange(0.50, 0.81, 0.02), 2).tolist() + [round(B.cos_for_p(0.3), 3), round(B.COS_P50, 3)]:
    rows.append({"coseno": t,
                 "dev_encontrado_con_etiqueta": float((okd & (bd >= t)).mean()), "dev_falsa_alarma": float((impd >= t).mean()),
                 "test_encontrado_con_etiqueta": float((okt & (bt >= t)).mean()), "test_falsa_alarma": float((impt >= t).mean())})
rows.sort(key=lambda r: r["coseno"])
ok = [r for r in rows if r["dev_falsa_alarma"] <= 0.10]
pick = min(ok, key=lambda r: r["coseno"])
out = {"consultas_dev": int(dev.sum()), "consultas_test": int(q.sum()), "galeria_test": int(g.sum()),
       "barrido": rows, "umbral_elegido_dev_FA<=10%": pick,
       "actual_30pct": next(r for r in rows if abs(r["coseno"] - round(B.cos_for_p(0.3), 3)) < 1e-9)}
Path(sys.argv[2]).write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
print(json.dumps(out, indent=1, ensure_ascii=False))
