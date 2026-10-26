package com.example.pets.petproject.domain.service;

/**
 * Resultado del analisis de una imagen por el ml-service: embedding individual
 * (EfficientNetB0 crudo) + raza predicha (20 razas u "Otro") con su confianza,
 * y la compuerta de animal: "dog" o lo que se detecto en su lugar
 * ("cat", "plush", "animal", "object"; en el modelo v1 "wild_canid" u "other").
 */
public record ImageAnalysis(float[] embedding, String breed, Float breedConfidence, String animal) {

    public boolean isDog() {
        return animal == null || "dog".equals(animal);
    }
}
