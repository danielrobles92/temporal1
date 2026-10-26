"""Construye prototipos de raza (vector promedio por raza) con el backbone mx20,
para clasificar la raza por cercania de coseno (sin necesidad de la cabeza ArcFace).

Salida: models/mx20_prototypes.pt  =  {"classes": [...], "prototypes": tensor[20,1280]}
"""
import argparse
import json
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BREEDS = ROOT / "experiments" / "mx_breeds.json"

EVAL_TF = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def make_backbone(weights_path):
    m = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    m.classifier = nn.Identity()
    m.load_state_dict(torch.load(weights_path, map_location=DEV, weights_only=True))
    return m.eval().to(DEV)


@torch.inference_mode()
def embed_batch(model, imgs):
    x = torch.stack([EVAL_TF(im) for im in imgs]).to(DEV)
    v = model(x)
    return torch.nn.functional.normalize(v, p=2, dim=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--breeds-json", type=str, default=str(DEFAULT_BREEDS))
    ap.add_argument("--weights", type=str, default="mx20", help="nombre base en models/")
    ap.add_argument("--out", type=str, default=None, help="por defecto <weights>_prototypes")
    args = ap.parse_args()

    cfg_path = Path(args.breeds_json).resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    data = (cfg_path.parent / cfg["dataset_root"]).resolve()
    out_name = args.out or f"{args.weights}_prototypes"
    print(f"Device: {DEV} | data: {data} | pesos: {args.weights}.pt", flush=True)

    backbone = make_backbone(ROOT / "models" / f"{args.weights}.pt")
    classes, protos = [], []
    # validacion simple: clasificar cada imagen por prototipo (deja-uno-fuera aprox.)
    all_embs, all_labels = [], []

    for idx, b in enumerate(cfg["breeds"]):
        folder = data / b["folder"]
        paths = sorted(folder.glob("*.jpg")) + sorted(folder.glob("*.jpeg")) + sorted(folder.glob("*.png"))
        embs = []
        for i in range(0, len(paths), 64):
            batch = [Image.open(p).convert("RGB") for p in paths[i:i + 64]]
            e = embed_batch(backbone, batch)
            embs.append(e)
        e = torch.cat(embs)
        proto = torch.nn.functional.normalize(e.mean(0), p=2, dim=0)
        protos.append(proto)
        classes.append(b["name_es"])
        all_embs.append(e)
        all_labels += [idx] * e.size(0)
        print(f"  {b['name_es']:32s} {e.size(0):4d} imgs", flush=True)

    P = torch.stack(protos)  # [20, 1280]
    torch.save({"classes": classes, "prototypes": P.cpu()}, ROOT / "models" / f"{out_name}.pt")

    # exactitud de clasificacion por prototipo (sobre todo el set)
    E = torch.cat(all_embs)
    y = torch.tensor(all_labels, device=DEV)
    pred = (E @ P.T).argmax(1)
    acc = (pred == y).float().mean().item()
    print(f"\nGuardado prototipos [{P.shape}] | acc por prototipo: {acc*100:.1f}%")


if __name__ == "__main__":
    main()
