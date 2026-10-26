"""Banco de pruebas de la red neuronal (DOCS/Tabla_Pruebas_Red_Neuronal.docx).

Corre el MISMO pipeline que el servicio (app/model.py + app/analyzer.py: EfficientNetB0
crudo para el vector individual, DogNet v2 para perro/no-perro y raza, y la red de
etapa cachorro/adulto) sobre
fotos que NO se usaron para entrenar, y mide cada escenario PI-xx de la tabla.

Fuentes de prueba (ninguna se uso para entrenar la red de re-identificacion):
  MPDD     Multi-pose Dog Dataset (Mendeley, CC BY 4.0): 191 perros, 1,657 fotos,
           varias fotos por perro en distintas poses. Parte "dev" (train+val, 95 perros)
           para elegir umbrales; parte "test" (query/gallery, 96 perros) solo para medir.
  COCO     val2017 (+ fotos con varios perros de train2017), ver prepare_pruebas_coco.py
  R3P0     dataset de razas del proyecto (perros distintos de la misma raza y color)
  DogAge   fotos de perros como relleno para simular una base de datos grande
  Open Images (test)  cachorro SI/NO verificado por personas (prepare_age_openimages.py)

Decision del sistema (backend, ImageEmbeddingService.sameDogProbability):
  P(mismo perro) = sigmoid(30.9448 * coseno - 23.0951)   -> 50 % en coseno 0.746
  front: >= 70 % "Muy probable", >= 30 % "Posible", si no "Poco probable"
  otra raza del catalogo -> P x 0.15 y puntaje visual a la mitad

Uso:
  python experiments/banco_pruebas.py                 # todo -> experiments/resultados_banco_pruebas.json
  python experiments/banco_pruebas.py --only PI-16    # una sola prueba
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import random
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageEnhance, ImageFile, ImageFilter

ImageFile.LOAD_TRUNCATED_IMAGES = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.analyzer import DogAnalyzer  # noqa: E402
from app.model import EfficientNetEmbedder  # noqa: E402

DS = ROOT.parent / "imagesDS"
MPDD = DS / "MPDD" / "MPDD" / "pytorch"
COCO = DS / "_downloads" / "coco_pruebas"
CACHE = DS / "_v2cache"
OUT = ROOT / "experiments" / "resultados_banco_pruebas.json"
CALIB_W, CALIB_B = 30.9448, -23.0951
COS_P50 = -CALIB_B / CALIB_W                    # 0.7463
LEVELS = {"posible (>=30 %)": 0.30, "probable (>=50 %)": 0.50, "muy probable (>=70 %)": 0.70}


def p_same(cos):
    return 1.0 / (1.0 + np.exp(-(CALIB_W * np.asarray(cos) + CALIB_B)))


def cos_for_p(p):
    return (math.log(p / (1 - p)) - CALIB_B) / CALIB_W


# ----------------------------------------------------------------------------- modelos
class Pipeline:
    def __init__(self, device="cuda", age_path="models/dognet_puppy.pt", with_color=False):
        self.device = torch.device(device)
        self.emb = EfficientNetEmbedder(device=device)
        age = ROOT / age_path
        self.an = DogAnalyzer(ROOT / "models/dognet_v2.pt", self.device, ROOT / "models/dognet_v2_thresholds.json",
                              with_color=with_color, age_path=age if age.exists() else None)

    def embed(self, imgs, bs=64):
        vecs, gates = [], []
        for i in range(0, len(imgs), bs):
            v, g = self.emb.analyze_images(imgs[i:i + bs])
            vecs.append(np.asarray(v, dtype=np.float32))
            gates += g
        return (np.concatenate(vecs) if vecs else np.zeros((0, 1280), np.float32)), gates

    def describe(self, imgs, gates=None, bs=32):
        out = []
        for i in range(0, len(imgs), bs):
            out += self.an.describe(imgs[i:i + bs], gates[i:i + bs] if gates else None)
        return out


def timed(fn, *a, n_items=1, **kw):
    t = time.perf_counter()
    r = fn(*a, **kw)
    if torch.cuda.is_available():
        torch.cuda.synchronize()
    return r, (time.perf_counter() - t) * 1000 / max(1, n_items)


# ----------------------------------------------------------------------------- MPDD
def load_mpdd():
    recs = []
    for part, folders in (("dev", ("train", "val")), ("query", ("query",)), ("gallery", ("gallery",))):
        for fo in folders:
            for f in sorted(os.listdir(MPDD / fo)):
                pid, cam = f.split("_")[0], f.split("_")[1][:2]
                recs.append({"path": MPDD / fo / f, "id": int(pid), "cam": cam, "part": part})
    imgs = [Image.open(r["path"]).convert("RGB") for r in recs]
    return recs, imgs


def ranking(S, qid, gid, exclude=None):
    """Top-1, Top-5 y mAP. S [Q, G] cosenos; exclude [Q, G] True = no participa."""
    S = S.copy()
    if exclude is not None:
        S[exclude] = -np.inf
    pos = (gid[None, :] == qid[:, None]) & np.isfinite(S)
    valid = pos.any(1)
    order = np.argsort(-S, axis=1)
    hit = np.take_along_axis(pos, order, 1)
    top1, top5 = hit[:, 0], hit[:, :5].any(1)
    aps = []
    for i in np.where(valid)[0]:
        ranks = np.where(hit[i])[0]
        aps.append(np.mean((np.arange(len(ranks)) + 1) / (ranks + 1)))
    return {"n_consultas": int(valid.sum()), "top1": float(top1[valid].mean()), "top5": float(top5[valid].mean()),
            "mAP": float(np.mean(aps))}


def loo_exclude(n):
    return np.eye(n, dtype=bool)


# ----------------------------------------------------------------------------- degradaciones
def _np(img):
    return np.asarray(img, dtype=np.float32)


def _pil(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def noise(img, sigma, rng):
    return _pil(_np(img) + rng.normal(0, sigma, _np(img).shape))


def motion_blur(img, k=11):
    a = _np(img)
    out = np.zeros_like(a)
    for s in range(-(k // 2), k // 2 + 1):
        out += np.roll(a, s, axis=1)
    return _pil(out / k)


def lowres(img, side=48):
    s = side / min(img.size)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.BILINEAR)


def jpeg(img, q):
    b = io.BytesIO()
    img.save(b, "JPEG", quality=q)
    return Image.open(io.BytesIO(b.getvalue())).convert("RGB")


def backlight(img):
    """Contraluz: sujeto oscuro (gamma) + fondo quemado con gradiente desde arriba."""
    a = 255 * (_np(img) / 255) ** 2.4 * 0.75
    h, w = a.shape[:2]
    grad = np.linspace(1.0, 0.35, h)[:, None, None] * 255
    return _pil(a * 0.7 + grad * 0.55)


def rect_occlusion(img, frac=0.35, color=(128, 128, 128)):
    w, h = img.size
    s = math.sqrt(frac)
    x0, y0 = int(w * (1 - s) / 2), int(h * (1 - s) / 2)
    im = img.copy()
    ImageDraw.Draw(im).rectangle([x0, y0, x0 + int(w * s), y0 + int(h * s)], fill=color)
    return im


def random_erase(img, rng, n=2, frac=0.2):
    im = img.copy()
    w, h = im.size
    d = ImageDraw.Draw(im)
    for _ in range(n):
        s = math.sqrt(frac)
        bw, bh = int(w * s), int(h * s)
        x, y = rng.integers(0, max(1, w - bw)), rng.integers(0, max(1, h - bh))
        d.rectangle([x, y, x + bw, y + bh], fill=tuple(int(c) for c in rng.integers(0, 255, 3)))
    return im


def clothes(img, rng):
    """Ropa: franja de "sueter" a rayas sobre el centro del cuerpo."""
    im = img.copy()
    w, h = im.size
    col = [tuple(int(c) for c in rng.integers(0, 255, 3)) for _ in range(2)]
    d = ImageDraw.Draw(im)
    x0, x1, y0, y1 = int(w * 0.25), int(w * 0.75), int(h * 0.35), int(h * 0.7)
    stripe = max(3, (y1 - y0) // 6)
    for k, y in enumerate(range(y0, y1, stripe)):
        d.rectangle([x0, y, x1, min(y1, y + stripe)], fill=col[k % 2])
    return im


def wet_dirty(img, rng):
    """Mojado/sucio: mas oscuro y contrastado, tinte cafe y manchas."""
    a = _np(ImageEnhance.Contrast(ImageEnhance.Brightness(img).enhance(0.7)).enhance(1.25))
    a = a * 0.75 + np.array([110, 80, 50], np.float32) * 0.25
    h, w = a.shape[:2]
    for _ in range(int(rng.integers(6, 12))):
        cy, cx, r = rng.integers(0, h), rng.integers(0, w), rng.integers(max(2, h // 25), max(3, h // 10))
        yy, xx = np.ogrid[:h, :w]
        m = (yy - cy) ** 2 + (xx - cx) ** 2 <= r * r
        a[m] = a[m] * 0.45 + np.array([70, 50, 30]) * 0.55
    return _pil(a)


def make_variants():
    """nombre -> (grupo PI, funcion(img, rng))."""
    return {
        "borrosa (gauss r=2.5)": ("PI-06", lambda im, r: im.filter(ImageFilter.GaussianBlur(2.5))),
        "baja resolucion (48 px)": ("PI-06", lambda im, r: lowres(im, 48)),
        "movimiento (11 px)": ("PI-06", lambda im, r: motion_blur(im, 11)),
        "poca luz + ruido": ("PI-06", lambda im, r: noise(ImageEnhance.Brightness(im).enhance(0.3), 8, r)),
        "JPEG muy comprimido (q=10)": ("PI-06", lambda im, r: jpeg(im, 10)),
        "noche": ("PI-07", lambda im, r: noise(_pil(_np(ImageEnhance.Brightness(im).enhance(0.18)) * [0.8, 0.9, 1.25]), 10, r)),
        "sobreexposicion": ("PI-07", lambda im, r: ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(1.9)).enhance(0.8)),
        "contraluz": ("PI-07", lambda im, r: backlight(im)),
        "solo mitad superior": ("PI-09", lambda im, r: im.crop((0, 0, im.width, im.height // 2))),
        "solo mitad inferior": ("PI-09", lambda im, r: im.crop((0, im.height // 2, im.width, im.height))),
        "objeto delante (35 %)": ("PI-09", lambda im, r: rect_occlusion(im, 0.35)),
        "2 objetos aleatorios (2x20 %)": ("PI-09", lambda im, r: random_erase(im, r)),
        "con ropa (sueter)": ("PI-11", lambda im, r: clothes(im, r)),
        "mojado / sucio": ("PI-11", lambda im, r: wet_dirty(im, r)),
    }


def sharpness(img):
    g = np.asarray(img.convert("L").resize((224, 224)), dtype=np.float32)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var())


# ----------------------------------------------------------------------------- pruebas
def system_scores(S, breeds_q, breeds_g):
    """Puntaje del backend sin ubicacion/sexo/color: raza 40 + visual 40 (x0.5 si otra raza)."""
    bq = np.array([b if b and b != "Otro" else "" for b in breeds_q])
    bg = np.array([b if b and b != "Otro" else "" for b in breeds_g])
    both = (bq[:, None] != "") & (bg[None, :] != "")
    same = both & (bq[:, None] == bg[None, :])
    mism = both & ~same
    vis = np.clip(S, 0, 1)
    score = 40 * same + 40 * np.where(mism, vis * 0.5, vis)
    conf = p_same(vis) * np.where(mism, 0.15, 1.0)
    return score, conf


def open_set(S, qid, gid, exclude=None, conf=None):
    """Perro SIN registro: se quita su identidad de la galeria. % de consultas cuyo mejor
    candidato (otro perro) sale con confianza >= nivel."""
    S = S.copy()
    S[gid[None, :] == qid[:, None]] = -np.inf
    if exclude is not None:
        S[exclude] = -np.inf
    j = S.argmax(1)
    best = S[np.arange(len(S)), j]
    c = p_same(np.clip(best, 0, 1)) if conf is None else conf[np.arange(len(S)), j]
    return {"n_consultas": len(S), "coseno_mejor_impostor_mediana": float(np.median(best)),
            **{f"falsa_alarma_{k}": float((c >= v).mean()) for k, v in LEVELS.items()}}


def auc_pairs(s, same):
    """AUC de la curva ROC completa (estadistico de Mann-Whitney): probabilidad de que un
    par del mismo perro tenga mas coseno que un par de perros distintos."""
    ranks = np.empty(len(s))
    ranks[np.argsort(s, kind="mergesort")] = np.arange(1, len(s) + 1)
    n_pos, n_neg = int(same.sum()), int((~same).sum())
    return float((ranks[same].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def pair_rates(S, ids, mask=None):
    iu = np.triu_indices(len(ids), 1)
    s = S[iu]
    same = (ids[:, None] == ids[None, :])[iu]
    if mask is not None:
        keep = mask[iu]
        s, same = s[keep], same[keep]
    return s, same


def save(res):
    """Guarda lo medido hasta ahora (si el proceso se corta no se pierde lo anterior)."""
    OUT.write_text(json.dumps(res, indent=1, ensure_ascii=False, default=float), encoding="utf-8")


def run(args):
    res = {"fecha": time.strftime("%Y-%m-%d %H:%M"), "dispositivo": torch.cuda.get_device_name(0)
           if torch.cuda.is_available() else "cpu", "coseno_p50": round(COS_P50, 4),
           "coseno_p30": round(cos_for_p(0.3), 4), "coseno_p70": round(cos_for_p(0.7), 4)}
    if OUT.exists() and args.only:
        res = json.loads(OUT.read_text(encoding="utf-8"))
    want = (lambda k: True) if not args.only else (lambda k: k in args.only)
    pipe = Pipeline(age_path=args.age_model)
    rng = np.random.default_rng(0)

    need_mpdd = any(want(k) for k in ["PI-01", "PI-02", "PI-03", "PI-04", "PI-05", "PI-06", "PI-07", "PI-08",
                                      "PI-09", "PI-10", "PI-11", "PI-12", "PI-17", "PI-18", "PI-19"])
    if need_mpdd:
        recs, imgs = load_mpdd()
        ids = np.array([r["id"] for r in recs])
        parts = np.array([r["part"] for r in recs])
        cams = np.array([r["cam"] for r in recs])
        (E, gates), ms = timed(pipe.embed, imgs, n_items=len(imgs))
        descs = pipe.describe(imgs, gates)
        breeds = [d["breed"] if d["is_dog"] else None for d in descs]
        S_all = E @ E.T
        sizes = np.array([min(im.size) for im in imgs])
        res["MPDD"] = {"perros": int(len(set(ids))), "fotos": len(imgs),
                       "perros_dev": int(len(set(ids[parts == "dev"]))), "fotos_dev": int((parts == "dev").sum()),
                       "perros_test": int(len(set(ids[parts != "dev"]))),
                       "consultas_test": int((parts == "query").sum()), "galeria_test": int((parts == "gallery").sum()),
                       "lado_menor_px": {"min": int(sizes.min()), "mediana": float(np.median(sizes)), "max": int(sizes.max())},
                       "ms_por_imagen_vector": round(ms, 2),
                       "aceptadas_como_perro": float(np.mean([d["is_dog"] for d in descs])),
                       "razas_detectadas": Counter(b or "rechazada" for b in breeds).most_common(6)}
        dev = parts == "dev"
        q, g = parts == "query", parts == "gallery"
        loo = loo_exclude(len(imgs))
        base_all = ranking(S_all, ids, ids, loo)
        res["base_MPDD_completo"] = base_all

    save(res)
    if want("PI-01"):
        # misma foto (mismos bytes) y la misma foto re-subida (re-comprimida y escalada)
        same_E, _ = pipe.embed(imgs)
        resub = [jpeg(im.resize((max(1, int(im.width * 0.9)), max(1, int(im.height * 0.9)))), 85) for im in imgs]
        (R, _), ms = timed(pipe.embed, resub, n_items=len(resub))
        exact = np.einsum("ij,ij->i", same_E, E)
        S = R @ E.T
        top1 = (S.argmax(1) == np.arange(len(imgs)))
        res["PI-01"] = {"n": len(imgs), "perros": int(len(set(ids))),
                        "misma_foto_top1": float(((same_E @ E.T).argmax(1) == np.arange(len(imgs))).mean()),
                        "misma_foto_coseno_min": float(exact.min()),
                        "resubida_top1": float(top1.mean()), "resubida_coseno_min": float(S.diagonal().min()),
                        "resubida_confianza_min": float(p_same(S.diagonal().min())), "ms_por_imagen": round(ms, 2)}

    save(res)
    if want("PI-02"):
        Sd = S_all[np.ix_(dev, dev)]
        r = ranking(Sd, ids[dev], ids[dev], loo_exclude(int(dev.sum())))
        sc, conf = system_scores(Sd, [breeds[i] for i in np.where(dev)[0]], [breeds[i] for i in np.where(dev)[0]])
        rs = ranking(sc / 100.0, ids[dev], ids[dev], loo_exclude(int(dev.sum())))
        res["PI-02"] = {"perros": int(len(set(ids[dev]))), "fotos": int(dev.sum()), "visual": r, "sistema_raza_mas_visual": rs}

    save(res)
    if want("PI-03"):
        Sq = S_all[np.ix_(q, g)]
        r = ranking(Sq, ids[q], ids[g])
        sc, conf = system_scores(Sq, [breeds[i] for i in np.where(q)[0]], [breeds[i] for i in np.where(g)[0]])
        rs = ranking(sc / 100.0, ids[q], ids[g])
        best = Sq.max(1)
        res["PI-03"] = {"perros": int(len(set(ids[q]))), "consultas": int(q.sum()), "galeria": int(g.sum()),
                        "visual": r, "sistema_raza_mas_visual": rs,
                        "top1_con_confianza_>=50": float(((Sq.argmax(1) >= 0) &
                                                          (ids[g][Sq.argmax(1)] == ids[q]) & (best >= COS_P50)).mean())}

    save(res)
    if want("PI-04"):
        Sq = S_all[np.ix_(q, g)]
        sc, conf = system_scores(Sq, [breeds[i] for i in np.where(q)[0]], [breeds[i] for i in np.where(g)[0]])
        res["PI-04"] = {"test_visual": open_set(Sq, ids[q], ids[g]),
                        "test_sistema_con_raza": open_set(sc, ids[q], ids[g], conf=conf),
                        "MPDD_completo_visual": open_set(S_all, ids, ids, loo)}

    save(res)
    variants = make_variants()
    if any(want(k) for k in ("PI-05", "PI-06", "PI-07", "PI-09", "PI-11")):
        sh = np.array([sharpness(im) for im in imgs])
        hq = (sizes >= 224) & (sh >= np.median(sh))
        Sx = S_all.copy()
        res["PI-05"] = {"criterio_alta_calidad": "lado menor >= 224 px y nitidez (varianza del laplaciano) >= mediana",
                        "alta_calidad": ranking(Sx[hq], ids[hq], ids, loo[hq]),
                        "resto": ranking(Sx[~hq], ids[~hq], ids, loo[~hq]), "todas": base_all}
        for name, (grp, fn) in variants.items():
            if not want(grp):
                continue
            r2 = np.random.default_rng(1)
            vimgs = [fn(im, r2) for im in imgs]
            (V, vg), ms = timed(pipe.embed, vimgs, n_items=len(vimgs))
            vd = pipe.describe(vimgs, vg)
            r = ranking(V @ E.T, ids, ids, loo)
            r["aceptadas_como_perro"] = float(np.mean([d["is_dog"] for d in vd]))
            r["caida_top1_pts"] = round((base_all["top1"] - r["top1"]) * 100, 1)
            r["ms_por_imagen"] = round(ms, 2)
            res.setdefault(grp, {})[name] = r

    save(res)
    if want("PI-08"):
        same_cam = cams[:, None] == cams[None, :]
        pos = ids[:, None] == ids[None, :]
        res["PI-08"] = {"solo_otra_pose": ranking(S_all, ids, ids, loo | (pos & same_cam)),
                        "solo_misma_pose": ranking(S_all, ids, ids, loo | (pos & ~same_cam)),
                        "espejo_(lado_contrario)": None}
        (Fl, _), _ = timed(pipe.embed, [im.transpose(Image.FLIP_LEFT_RIGHT) for im in imgs])
        res["PI-08"]["espejo_(lado_contrario)"] = ranking(Fl @ E.T, ids, ids, loo)

    save(res)
    if want("PI-10"):
        # (a) MPDD: el impostor mas parecido supera al perro correcto
        Sx = S_all.copy()
        Sx[loo] = -np.inf
        pos = ids[:, None] == ids[None, :]
        best_pos = np.where(pos, Sx, -np.inf).max(1)
        best_neg = np.where(~pos, Sx, -np.inf).max(1)
        ok = np.isfinite(best_pos)
        a = {"n_consultas": int(ok.sum()), "impostor_supera_al_correcto": float((best_neg > best_pos)[ok].mean()),
             **{f"impostor_{k}": float((p_same(np.clip(best_neg, 0, 1)) >= v)[ok].mean()) for k, v in LEVELS.items()}}
        # (b) R3P0: perros distintos de la MISMA raza y MISMO color
        r3 = DS / "R3P0"
        files = sorted(p for p in r3.glob("*/*.jpg"))
        pipe_c = Pipeline(age_path=args.age_model, with_color=True)
        RE, rd = [], []
        for i in range(0, len(files), 256):                 # por bloques: menos RAM
            chunk = [Image.open(p).convert("RGB") for p in files[i:i + 256]]
            ce, cg = pipe_c.embed(chunk)
            RE.append(ce)
            rd += pipe_c.describe(chunk, cg)
        RE = np.concatenate(RE)
        del pipe_c
        torch.cuda.empty_cache()
        breed_f = np.array([p.parent.name for p in files])
        color = np.array([d.get("color_label") or "?" for d in rd])
        SR = RE @ RE.T
        iu = np.triu_indices(len(files), 1)
        same_b = (breed_f[:, None] == breed_f[None, :])[iu]
        same_c = (color[:, None] == color[None, :])[iu] & (color[iu[0]] != "?")
        s = SR[iu]
        dup = s >= 0.97                                  # misma foto repetida en el dataset
        sel = same_b & same_c & ~dup
        sel_b = same_b & ~dup
        res["PI-10"] = {"MPDD_impostor": a,
                        "R3P0_misma_raza_y_color": {"pares": int(sel.sum()), "fotos": len(files),
                                                    "posibles_duplicados_excluidos": int((same_b & dup).sum()),
                                                    **{f"falsa_coincidencia_{k}": float((s[sel] >= cos_for_p(v)).mean())
                                                       for k, v in LEVELS.items()},
                                                    "coseno_p99": float(np.percentile(s[sel], 99))},
                        "R3P0_misma_raza": {"pares": int(sel_b.sum()),
                                            **{f"falsa_coincidencia_{k}": float((s[sel_b] >= cos_for_p(v)).mean())
                                               for k, v in LEVELS.items()}}}
        np.save(CACHE / "banco_r3p0_E.npy", RE)

    save(res)
    if want("PI-12"):
        meta = json.loads((COCO / "coco_pruebas.json").read_text(encoding="utf-8"))["varios_perros"]
        files = sorted(meta)
        full = [Image.open(COCO / "varios_perros" / f).convert("RGB") for f in files]
        (FE, fg), ms = timed(pipe.embed, full, n_items=len(full))
        fd = pipe.describe(full, fg)
        crops, owner, rank_in = [], [], []
        for k, f in enumerate(files):
            for j, (x, y, w, h) in enumerate(meta[f]["boxes"]):
                crops.append(full[k].crop((int(x), int(y), int(x + w), int(y + h))))
                owner.append(k)
                rank_in.append(j)
        CE, _ = pipe.embed(crops)
        owner, rank_in = np.array(owner), np.array(rank_in)
        # A) consulta = foto con varios perros; galeria = recortes individuales + MPDD
        G = np.concatenate([CE, E])
        gown = np.concatenate([owner, -1 - np.arange(len(E))])
        S = FE @ G.T
        o = np.argsort(-S, 1)
        hit1 = gown[o[:, 0]] == np.arange(len(files))
        hit5 = (gown[o[:, :5]] == np.arange(len(files))[:, None]).any(1)
        top_is_biggest = np.array([(gown[o[i, 0]] == i) and rank_in[o[i, 0]] == 0 for i in range(len(files))])
        # B) consulta = recorte de UN perro; galeria = fotos con varios perros + MPDD
        G2 = np.concatenate([FE, E])
        S2 = CE @ G2.T
        o2 = np.argsort(-S2, 1)
        h1 = o2[:, 0] == owner
        h5 = (o2[:, :5] == owner[:, None]).any(1)
        res["PI-12"] = {"fotos": len(files), "perros_en_fotos": len(crops),
                        "aceptadas_como_perro": float(np.mean([d["is_dog"] for d in fd])),
                        "razas": Counter(d["breed"] or "rechazada" for d in fd).most_common(5),
                        "foto_grupal_encuentra_a_uno_de_sus_perros_top1": float(hit1.mean()),
                        "foto_grupal_top5": float(hit5.mean()),
                        "foto_grupal_top1_es_el_perro_mas_grande": float(top_is_biggest.mean()),
                        "perro_individual_encuentra_la_foto_grupal_top1": float(h1.mean()),
                        "perro_individual_top5": float(h5.mean()),
                        "perro_mas_grande_top1": float(h1[rank_in == 0].mean()),
                        "perro_secundario_top1": float(h1[rank_in > 0].mean()),
                        "distractores": len(E), "ms_por_imagen": round(ms, 2)}

    save(res)
    for key, groups in (("PI-13", ["otros_animales"]), ("PI-14", ["sin_animales"]), ("PI-15", ["objetos"])):
        if not want(key):
            continue
        out = {}
        tot, rej = 0, 0
        for grp in groups:
            for sub in sorted(os.listdir(COCO / grp)):
                paths = sorted((COCO / grp / sub).glob("*.jpg"))
                ims = [Image.open(p).convert("RGB") for p in paths]
                (V, gg), ms = timed(pipe.embed, ims, n_items=len(ims))
                dd = pipe.describe(ims, gg)
                r = sum(not d["is_dog"] for d in dd)
                out[sub] = {"n": len(ims), "rechazadas": r, "tasa_rechazo": r / len(ims),
                            "tipo": Counter(d["not_dog_type"] or "perro (error)" for d in dd).most_common(3)}
                tot, rej = tot + len(ims), rej + r
        out["total"] = {"n": tot, "rechazadas": rej, "tasa_rechazo": rej / tot}
        res[key] = out

    save(res)
    if want("PI-16"):
        res["PI-16"] = error_cases(imgs[0] if need_mpdd else None)

    save(res)
    if want("PI-17"):
        out = {}
        for name, m in (("dev", dev), ("test", ~dev)):
            s, same = pair_rates(S_all[np.ix_(m, m)], ids[m])
            rows = []
            for t in (0.60, 0.65, 0.70, cos_for_p(0.3), COS_P50, 0.75, cos_for_p(0.7), 0.80, 0.85, 0.90):
                rows.append({"coseno": round(float(t), 3), "confianza": round(float(p_same(t)), 3),
                             "TPR_mismo_perro": float((s[same] >= t).mean()),
                             "FPR_perros_distintos": float((s[~same] >= t).mean())})
            ts = np.linspace(0.3, 0.95, 131)
            fpr = np.array([(s[~same] >= t).mean() for t in ts])
            tpr = np.array([(s[same] >= t).mean() for t in ts])
            k = int(np.argmin(np.abs(fpr - (1 - tpr))))
            k1 = int(np.argmax(fpr <= 0.01))
            out[name] = {"pares_mismo_perro": int(same.sum()), "pares_perros_distintos": int((~same).sum()),
                         "coseno_medio_mismo": float(s[same].mean()), "coseno_medio_distintos": float(s[~same].mean()),
                         "umbrales": rows, "EER": {"coseno": float(ts[k]), "tasa": float((fpr[k] + 1 - tpr[k]) / 2)},
                         "umbral_FPR_1pct": {"coseno": float(ts[k1]), "TPR": float(tpr[k1])},
                         "AUC": auc_pairs(s, same)}
        res["PI-17"] = out

    save(res)
    if want("PI-18"):
        resub = [jpeg(im.resize((max(1, int(im.width * 0.8)), max(1, int(im.height * 0.8)))), 80) for im in imgs]
        shot = [jpeg(im.crop((int(im.width * 0.03), int(im.height * 0.03), int(im.width * 0.97),
                              int(im.height * 0.97))), 90) for im in imgs]
        same_E, _ = pipe.embed(imgs)
        R, _ = pipe.embed(resub)
        C, _ = pipe.embed(shot)
        Sx = S_all.copy()
        Sx[loo] = -np.inf
        pos = ids[:, None] == ids[None, :]
        other_photo = np.where(pos, Sx, -np.inf).max(1)
        other_dog = np.where(~pos, Sx, -np.inf).max(1)
        rcos, ccos = np.einsum("ij,ij->i", R, E), np.einsum("ij,ij->i", C, E)
        thr = 0.97
        res["PI-18"] = {"n": len(imgs), "identica_coseno_min": float(np.einsum("ij,ij->i", same_E, E).min()),
                        "recomprimida_coseno_min": float(rcos.min()), "recomprimida_coseno_p01": float(np.percentile(rcos, 1)),
                        "recorte_3pct_coseno_min": float(ccos.min()),
                        "otra_foto_mismo_perro_coseno_max": float(other_photo[np.isfinite(other_photo)].max()),
                        "otra_foto_mismo_perro_p99": float(np.percentile(other_photo[np.isfinite(other_photo)], 99)),
                        "otro_perro_coseno_max": float(other_dog.max()),
                        "regla_duplicado": f"coseno >= {thr}",
                        "duplicados_detectados_identica": float((np.einsum("ij,ij->i", same_E, E) >= thr).mean()),
                        "duplicados_detectados_recomprimida": float((rcos >= thr).mean()),
                        "duplicados_detectados_recorte": float((ccos >= thr).mean()),
                        "falsos_duplicados_otra_foto": float((other_photo[np.isfinite(other_photo)] >= thr).mean())}

    save(res)
    if want("PI-19"):
        res["PI-19"] = scaling(pipe, E, ids, q, g)

    save(res)
    if want("EDAD"):
        res["EDAD"] = age_tests(pipe, args)

    save(res)
    if want("TIEMPO"):
        res["TIEMPO"] = latency(args)

    OUT.write_text(json.dumps(res, indent=1, ensure_ascii=False, default=float), encoding="utf-8")
    print(json.dumps(res, indent=1, ensure_ascii=False, default=float)[:20000])
    print(f"-> {OUT}")


def scaling(pipe, E, ids, q, g):
    """Base de datos chica vs grande: galeria MPDD test + N fotos de otros perros."""
    cache = CACHE / "banco_relleno_E.npy"
    if cache.exists():
        D = np.load(cache)
    else:
        with open(CACHE / "manifest_dogage.csv", encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        random.Random(0).shuffle(rows)
        paths = [CACHE / r["path"] for r in rows[:16000]] + sorted((DS / "R3P0").glob("*/*.jpg"))
        D = []
        for i in range(0, len(paths), 256):
            D.append(pipe.embed([Image.open(p).convert("RGB") for p in paths[i:i + 256]])[0])
        D = np.concatenate(D)
        np.save(cache, D)
    out = []
    Qe, Ge = E[q], E[g]
    for n_extra in (0, 500, 2000, 5000, 10000, len(D)):
        G = np.concatenate([Ge, D[:n_extra]])
        gid = np.concatenate([ids[g], -np.ones(n_extra, int)])
        t = time.perf_counter()
        for _ in range(5):
            S = Qe @ G.T
            np.argsort(-S, 1)[:, :10]
        ms = (time.perf_counter() - t) * 1000 / 5 / len(Qe)
        # bucle tipo Java (un coseno por candidato) medido en numpy por fila
        t = time.perf_counter()
        for v in G[:2000]:
            float(np.dot(Qe[0], v))
        loop_ms = (time.perf_counter() - t) * 1000 / min(2000, len(G)) * len(G)
        r = ranking(S, ids[q], gid)
        r.update({"registros": len(G), "ms_busqueda_por_consulta_vectorizada": round(ms, 3),
                  "ms_busqueda_bucle_1_a_1_estimado": round(loop_ms, 1),
                  **{f"{k}_perro_sin_registro": v for k, v in open_set(S, ids[q], gid).items()
                     if k.startswith("falsa_alarma")}})
        out.append(r)
    return out


def error_cases(sample_img):
    from fastapi.testclient import TestClient
    from app.main import app
    buf = io.BytesIO()
    (sample_img or Image.new("RGB", (300, 300), "white")).save(buf, "JPEG")
    good = buf.getvalue()
    png, webp, gif = io.BytesIO(), io.BytesIO(), io.BytesIO()
    Image.open(io.BytesIO(good)).save(png, "PNG")
    Image.open(io.BytesIO(good)).save(webp, "WEBP")
    Image.open(io.BytesIO(good)).save(gif, "GIF")
    big = io.BytesIO()
    Image.fromarray(np.random.default_rng(0).integers(0, 255, (2600, 2600, 3), dtype=np.uint8)).save(big, "PNG")
    cases = [
        ("JPEG truncado (corrupto)", ("a.jpg", good[: len(good) // 3], "image/jpeg"), {400, 200}),
        ("bytes aleatorios con extension .jpg", ("b.jpg", os.urandom(20000), "image/jpeg"), {400}),
        ("archivo de texto", ("c.txt", b"hola mundo" * 100, "text/plain"), {400}),
        ("PDF", ("d.pdf", b"%PDF-1.4\n" + os.urandom(5000), "application/pdf"), {400}),
        ("HEIC (formato no admitido)", ("e.heic", b"\x00\x00\x00\x18ftypheic" + os.urandom(5000), "image/heic"), {400}),
        ("archivo vacio", ("f.jpg", b"", "image/jpeg"), {400}),
        (f"imagen de {len(big.getvalue()) / 1e6:.1f} MB (> 5 MB)", ("g.png", big.getvalue(), "image/png"), {400}),
        ("PNG valido", ("h.png", png.getvalue(), "image/png"), {200}),
        ("WEBP valido", ("i.webp", webp.getvalue(), "image/webp"), {200}),
        ("GIF valido", ("j.gif", gif.getvalue(), "image/gif"), {200}),
        ("JPEG valido", ("k.jpg", good, "image/jpeg"), {200}),
    ]
    out = []
    with TestClient(app) as client:
        for name, f, ok in cases:
            r = client.post("/analyze", files=[("files", f)])
            out.append({"caso": name, "http": r.status_code, "correcto": r.status_code in ok,
                        "detalle": (r.json().get("detail") if r.status_code != 200 else "procesada")})
        r = client.post("/analyze", files=[("files", ("x.jpg", good, "image/jpeg"))] * 9)
        out.append({"caso": "9 imagenes en una peticion (max 8)", "http": r.status_code, "correcto": r.status_code == 400,
                    "detalle": r.json().get("detail")})
        r = client.get("/health")
        out.append({"caso": "servicio sigue vivo despues de los errores", "http": r.status_code,
                    "correcto": r.status_code == 200, "detalle": r.json().get("status")})
    return {"casos": out, "correctos": sum(c["correcto"] for c in out), "total": len(out)}


def age_tests(pipe, args):
    """Etapa cachorro/adulto con fotos ajenas al entrenamiento (Open Images test, etiqueta
    "Puppy" verificada por personas), por el MISMO camino que el servicio (DogAnalyzer)."""
    rows = [r for r in csv.DictReader(open(CACHE / "age_manifest.csv", encoding="utf-8"))
            if r["source"] == "openimages" and r["split"] == "test"]
    ims = [Image.open(CACHE / r["path"]).convert("RGB") for r in rows]
    y = np.array([r["group"] == "cachorro" for r in rows])
    _, gates = pipe.embed(ims)
    t = time.perf_counter()
    dd = pipe.describe(ims, gates)
    ms = (time.perf_counter() - t) * 1000 / len(ims)
    dog = np.array([d["is_dog"] for d in dd])
    pup = np.array([d["is_dog"] and d["age"] == "cachorro" for d in dd])
    tp, fn = int((pup & y & dog).sum()), int((~pup & y & dog).sum())
    fp, tn = int((pup & ~y & dog).sum()), int((~pup & ~y & dog).sum())
    return {"fuente": "Open Images V7 test (nunca usado para entrenar)", "fotos": len(ims),
            "aceptadas_como_perro": float(dog.mean()), "umbral_P_cachorro": pipe.an.puppy_threshold,
            "n_cachorros": tp + fn, "n_adultos": fp + tn,
            "matriz": {"cachorro_como_cachorro": tp, "cachorro_como_adulto": fn,
                       "adulto_como_cachorro": fp, "adulto_como_adulto": tn},
            "recall_cachorro": tp / max(1, tp + fn), "recall_adulto": tn / max(1, tn + fp),
            "exactitud": (tp + tn) / max(1, tp + fn + fp + tn),
            "exactitud_balanceada": (tp / max(1, tp + fn) + tn / max(1, tn + fp)) / 2,
            "ms_por_imagen_describe": round(ms, 2)}


def latency(args):
    """Tiempo de /analyze (vector + raza + etapa + color) por imagen, GPU y CPU."""
    from fastapi.testclient import TestClient
    img = next((MPDD / "gallery").glob("*.jpg"))
    phone = Image.open(img).convert("RGB").resize((1200, 1600))
    b = io.BytesIO()
    phone.save(b, "JPEG", quality=90)
    data = b.getvalue()
    out = {"imagen_prueba": "foto 1200x1600 px (JPEG %.0f KB)" % (len(data) / 1024)}
    for dev in (["cuda"] if torch.cuda.is_available() else []) + ["cpu"]:
        os.environ["MLSERVICE_DEVICE"] = dev
        import importlib
        import app.config as cfg
        cfg.get_settings.cache_clear()
        import app.main as m
        importlib.reload(m)
        with TestClient(m.app) as client:
            for _ in range(3):
                client.post("/analyze", files=[("files", ("a.jpg", data, "image/jpeg"))])
            ts = []
            for _ in range(15 if dev == "cuda" else 8):
                t = time.perf_counter()
                r = client.post("/analyze", files=[("files", ("a.jpg", data, "image/jpeg"))])
                ts.append((time.perf_counter() - t) * 1000)
                assert r.status_code == 200
        out[dev] = {"ms_mediana": round(float(np.median(ts)), 1), "ms_p90": round(float(np.percentile(ts, 90)), 1)}
    os.environ.pop("MLSERVICE_DEVICE", None)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--age-model", default="models/dognet_puppy.pt")
    run(ap.parse_args())
