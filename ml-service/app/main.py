"""Punto de entrada del ml-service (FastAPI).

Servicio sin estado de vision para PERREQUE. Carga dos modelos EfficientNetB0:
- crudo (ImageNet)  -> embeddings individuales (POST /embeddings, /analyze)
- DogNet v2         -> perro/no-perro, raza (20 + Otro), tamano y color
- Red de etapa      -> cachorro (menos de 1 anio) o adulto
                       (POST /describe, /classify, /analyze). Si no existe
                       models/dognet_v2.pt se usa el clasificador anterior (mx20).

El backend Spring lo consume por HTTP. No accede a la base de datos.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile

from .analyzer import DogAnalyzer
from .config import get_settings
from .model import (BREED_MODEL_NAME, MODEL_NAME, BreedClassifier, DogCropper,
                    EfficientNetEmbedder, load_image, resolve_device)
from .schemas import (AnalyzeItem, AnalyzeResponse, BreedResult, BreedScore,
                      ClassifyResponse, DescribeItem, DescribeResponse,
                      EmbeddingItem, EmbeddingResponse, HealthResponse)

settings = get_settings()
state: dict = {"embedder": None, "breed": None, "dognet": None}
DOGNET_MODEL_NAME = "efficientnet_b0_dognet_v2"

ROOT = Path(__file__).resolve().parents[1]


@asynccontextmanager
async def lifespan(app: FastAPI):
    cropper = None
    if settings.use_dog_crop:
        cropper = DogCropper(device=settings.device, min_score=settings.dog_crop_min_score)
    state["cropper"] = cropper

    state["embedder"] = EfficientNetEmbedder(
        device=settings.device, l2_normalize=settings.l2_normalize, cropper=cropper)

    dognet_weights = ROOT / settings.dognet_weights_path
    if dognet_weights.exists():
        state["dognet"] = DogAnalyzer(dognet_weights, resolve_device(settings.device),
                                      ROOT / settings.dognet_thresholds_path,
                                      with_color=settings.dognet_color,
                                      age_path=ROOT / settings.dognet_age_path,
                                      with_age=settings.dognet_age)
    else:
        breed_weights = (ROOT / settings.breed_weights_path)
        breed_protos = (ROOT / settings.breed_prototypes_path)
        if breed_weights.exists() and breed_protos.exists():
            state["breed"] = BreedClassifier(
                breed_weights, breed_protos, device=settings.device,
                temperature=settings.breed_temperature, cropper=cropper)
    yield
    state["embedder"] = None
    state["breed"] = None
    state["dognet"] = None
    state["cropper"] = None


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Embeddings individuales (EfficientNetB0) + clasificacion de raza (mx20).",
    lifespan=lifespan,
)


def get_embedder() -> EfficientNetEmbedder:
    embedder = state.get("embedder")
    if embedder is None:
        raise HTTPException(status_code=503, detail="El modelo aun no esta disponible")
    return embedder


def get_breed() -> BreedClassifier:
    breed = state.get("breed")
    if breed is None:
        raise HTTPException(status_code=503, detail="El clasificador de raza no esta disponible")
    return breed


def breed_model_name() -> str:
    return DOGNET_MODEL_NAME if state.get("dognet") is not None else BREED_MODEL_NAME


def describe_raw(raw: List[bytes]):
    """(embeddings, descripciones) por imagen. Con DogNet v2 la descripcion trae
    perro/no-perro, raza u Otro, tamano, edad y color; sin el, el formato v1."""
    embedder = get_embedder()
    images = [load_image(d) for d in raw]
    vectors, gates = embedder.analyze_images(images)
    dognet = state.get("dognet")
    if dognet is not None:
        descs = dognet.describe(images, gates)
        for d, g in zip(descs, gates):
            d["dog_score"] = g["dog_score"]
        return vectors, descs
    preds = get_breed().classify(images)
    descs = [{"is_dog": g["is_dog"], "animal": g["animal"], "dog_score": g["dog_score"],
              "breed": p["breed"], "breed_confidence": p["confidence"], "breed_top": p["top"],
              "in_catalog": True}
             for p, g in zip(preds, gates)]
    return vectors, descs


async def read_uploads(files: List[UploadFile]) -> tuple[List[bytes], List[str]]:
    if not files:
        raise HTTPException(status_code=400, detail="Se requiere al menos una imagen")
    if len(files) > settings.max_batch_size:
        raise HTTPException(status_code=400,
                            detail=f"Maximo {settings.max_batch_size} imagenes por peticion")
    raw, names = [], []
    for upload in files:
        if upload.content_type and not upload.content_type.startswith("image/"):
            raise HTTPException(status_code=400,
                                detail=f"'{upload.filename}' no es una imagen ({upload.content_type})")
        data = await upload.read()
        if not data:
            raise HTTPException(status_code=400, detail=f"'{upload.filename}' esta vacio")
        if len(data) > settings.max_image_bytes:
            raise HTTPException(status_code=400, detail=f"'{upload.filename}' supera el tamano maximo")
        raw.append(data)
        names.append(upload.filename or "imagen")
    return raw, names


@app.get("/", tags=["meta"])
def root():
    return {"service": settings.app_name, "version": settings.app_version,
            "model": MODEL_NAME, "breed_model": breed_model_name(), "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health():
    embedder = state.get("embedder")
    breed = state.get("breed")
    dognet = state.get("dognet")
    info = None
    if dognet is not None:
        info = {"val_metrics": dognet.meta.get("val_metrics"),
                "trained_on": dognet.meta.get("trained_on"), "thresholds": dognet.thresholds,
                "classes": dognet.classes,
                "age_model": None if dognet.age_meta is None else {
                    "classes": dognet.age_meta["classes"], "threshold": dognet.puppy_threshold,
                    "test_metrics": dognet.age_meta.get("test_metrics", {}).get("openimages")}}
    return HealthResponse(
        status="ok" if embedder is not None else "loading",
        app=settings.app_name, version=settings.app_version,
        model=MODEL_NAME, breed_model=breed_model_name(),
        device=str(resolve_device(settings.device)),
        embedding_dim=settings.embedding_dim,
        model_loaded=embedder is not None,
        breed_loaded=breed is not None or dognet is not None,
        dog_crop=state.get("cropper") is not None,
        breeds=dognet.breeds if dognet is not None else (breed.classes if breed is not None else []),
        dognet=info,
    )


@app.post("/embeddings", response_model=EmbeddingResponse, tags=["embeddings"])
async def create_embeddings(files: List[UploadFile] = File(...)):
    """Embedding individual (EfficientNetB0 crudo) de una o varias imagenes."""
    raw, names = await read_uploads(files)
    embedder = get_embedder()
    try:
        vectors = embedder.embed_bytes(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    items = [EmbeddingItem(filename=n, dim=len(v), embedding=v) for n, v in zip(names, vectors)]
    return EmbeddingResponse(model=MODEL_NAME, dim=embedder.embedding_dim,
                             normalized=settings.l2_normalize, count=len(items), embeddings=items)


@app.post("/describe", response_model=DescribeResponse, tags=["breed"])
async def describe(files: List[UploadFile] = File(...)):
    """Describe al perro de cada foto: si es perro (o que es), raza u 'Otro', tamano,
    edad aproximada y color. Si no es perro devuelve is_dog=false y un mensaje."""
    raw, names = await read_uploads(files)
    try:
        _, descs = describe_raw(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    items = [DescribeItem(filename=n, **d) for n, d in zip(names, descs)]
    return DescribeResponse(model=breed_model_name(), count=len(items), items=items)


@app.post("/classify", response_model=ClassifyResponse, tags=["breed"])
async def classify(files: List[UploadFile] = File(...)):
    """Raza (20 + Otro) + compuerta perro/no-perro (formato compatible con v1)."""
    raw, names = await read_uploads(files)
    try:
        _, descs = describe_raw(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    results = [BreedResult(filename=n, confidence=d.get("breed_confidence", 0.0),
                           top=[BreedScore(**t) for t in d.get("breed_top", [])], **d)
               for n, d in zip(names, descs)]
    return ClassifyResponse(model=breed_model_name(), count=len(results), results=results)


@app.post("/analyze", response_model=AnalyzeResponse, tags=["embeddings"])
async def analyze(files: List[UploadFile] = File(...)):
    """Por imagen: embedding individual + descripcion (raza/Otro/no-perro, tamano, edad, color)."""
    raw, names = await read_uploads(files)
    embedder = get_embedder()
    try:
        vectors, descs = describe_raw(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    items = [AnalyzeItem(filename=n, embedding=v, **d) for n, v, d in zip(names, vectors, descs)]
    return AnalyzeResponse(embedding_model=MODEL_NAME, breed_model=breed_model_name(),
                           dim=embedder.embedding_dim, normalized=settings.l2_normalize,
                           count=len(items), items=items)
