"""Mide la mejora del backbone fine-tuned (mx20.pt) vs EfficientNet crudo (ImageNet)
para identificar al MISMO perro.

Proxy honesto (no hay etiquetas de perro individual): "otra foto del mismo perro"
= version aumentada de la misma imagen (flip, recorte, rotacion, brillo).

Dos pruebas:
  A) Recuperacion DENTRO de la misma raza (caso dificil real): galeria = N perros de
     una raza; consulta = version aumentada de uno; debe recuperarse a si mismo como #1.
  B) Separacion: sim(positivo=mismo) vs sim(impostor mas parecido). Cuanto mayor el
     margen, mas fiable el umbral de "es el mismo perro".
"""
import argparse
import json
import random
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image, ImageEnhance
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

random.seed(7)
torch.manual_seed(7)
DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BREEDS = ROOT / "experiments" / "mx_breeds.json"

EVAL_TF = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def augment(img):
    out = img.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = out.size
    dx, dy = int(w * 0.08), int(h * 0.08)
    out = out.crop((dx, dy, w - dx, h - dy)).resize((w, h)).rotate(10)
    out = ImageEnhance.Brightness(out).enhance(1.2)
    return ImageEnhance.Contrast(out).enhance(0.88)


def make_backbone(weights_path=None):
    m = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    m.classifier = nn.Identity()
    if weights_path:
        m.load_state_dict(torch.load(weights_path, map_location=DEV))
    return m.eval().to(DEV)


@torch.inference_mode()
def embed(model, img):
    x = EVAL_TF(img).unsqueeze(0).to(DEV)
    v = model(x)
    return torch.nn.functional.normalize(v, p=2, dim=1).squeeze(0)


def evaluate(name, model, cfg, data, n_breeds=12, gallery_per_breed=25, queries_per_breed=6):
    random.seed(7)  # mismas razas/consultas para todos los modelos comparados
    breeds = random.sample(cfg["breeds"], n_breeds)
    top1 = total = 0
    pos_sims, imp_sims = [], []

    for b in breeds:
        folder = data / b["folder"]
        imgs = sorted(folder.glob("*.jpg"))[:gallery_per_breed]
        if len(imgs) < 4:
            continue
        loaded = [Image.open(p).convert("RGB") for p in imgs]
        gal = [embed(model, im) for im in loaded]  # galeria misma raza (distintos perros)
        gal_t = torch.stack(gal)

        for qi in range(min(queries_per_breed, len(loaded))):
            q = embed(model, augment(loaded[qi]))      # "otra foto" del perro qi
            sims = gal_t @ q                            # coseno contra galeria
            best = int(sims.argmax())
            total += 1
            if best == qi:
                top1 += 1
            pos_sims.append(float(sims[qi]))
            # impostor mas parecido (otro perro de la misma raza)
            sims_imp = sims.clone()
            sims_imp[qi] = -1
            imp_sims.append(float(sims_imp.max()))

    m = lambda xs: sum(xs) / len(xs) if xs else float("nan")
    print(f"\n=== {name} ===")
    print(f"  recuperacion top-1 dentro de misma raza: {top1}/{total} = {top1/max(1,total)*100:.1f}%")
    print(f"  sim mismo perro (positivo):     {m(pos_sims):.3f}")
    print(f"  sim impostor misma raza:        {m(imp_sims):.3f}")
    print(f"  MARGEN (mismo - impostor):      {m(pos_sims) - m(imp_sims):+.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--breeds-json", type=str, default=str(DEFAULT_BREEDS))
    ap.add_argument("--weights", type=str, nargs="*", default=["mx20"],
                    help="nombres base en models/ a comparar contra el crudo")
    args = ap.parse_args()

    cfg_path = Path(args.breeds_json).resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    data = (cfg_path.parent / cfg["dataset_root"]).resolve()

    print(f"Device: {DEV} | data: {data}")
    evaluate("EfficientNetB0 CRUDO (ImageNet)", make_backbone(), cfg, data)
    for w in args.weights:
        evaluate(f"EfficientNetB0 FINE-TUNED ({w})",
                 make_backbone(ROOT / "models" / f"{w}.pt"), cfg, data)
