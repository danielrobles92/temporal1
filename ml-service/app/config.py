"""Configuracion del ml-service.

Los valores se pueden sobreescribir mediante variables de entorno (prefijo MLSERVICE_).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MLSERVICE_", env_file=".env")

    # Nombre y version expuestos en /health
    app_name: str = "perreque-ml-service"
    app_version: str = "0.1.0"

    # Dispositivo de inferencia: "auto" (cuda si hay GPU), "cuda" o "cpu".
    device: str = "auto"

    # Dimension del embedding generado por EfficientNetB0 (global average pooling).
    embedding_dim: int = 1280

    # Pesos del clasificador de raza fine-tuned (mx20) y sus prototipos.
    breed_weights_path: str = "models/mx20.pt"
    breed_prototypes_path: str = "models/mx20_prototypes.pt"

    # Temperatura del softmax de raza (mas baja = mas peaky).
    breed_temperature: float = 0.1

    # Modelo v2 (DogNet v2): perro/no-perro + 20 razas/Otro + tamano + edad.
    # Si el archivo existe reemplaza al clasificador mx20 en /classify y /analyze.
    dognet_weights_path: str = "models/dognet_v2.pt"
    dognet_thresholds_path: str = "models/dognet_v2_thresholds.json"
    # Etapa de vida: cachorro (menos de 1 anio) o adulto, con su propia red EfficientNetB0
    # (experiments/train_puppy.py). MLSERVICE_DOGNET_AGE=false la apaga.
    dognet_age: bool = True
    dognet_age_path: str = "models/dognet_puppy.pt"
    # Color del pelaje por segmentacion (DeepLabV3-MobileNetV3 de torchvision).
    dognet_color: bool = True

    # Recorte del perro (detector) antes de embeber/clasificar. Apagado por defecto:
    # la medicion sobre el dataset no mostro mejora (fotos ya centradas en el perro).
    # Activar para fotos reales con fondos variados (requiere re-calibrar + re-indexar).
    use_dog_crop: bool = False
    dog_crop_min_score: float = 0.3

    # Numero maximo de imagenes aceptadas por peticion.
    max_batch_size: int = 8

    # Tamano maximo por imagen en bytes (5 MB, alineado con el backend Spring).
    max_image_bytes: int = 5 * 1024 * 1024

    # Si es True, los embeddings se normalizan con norma L2 (cos = producto punto).
    l2_normalize: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
