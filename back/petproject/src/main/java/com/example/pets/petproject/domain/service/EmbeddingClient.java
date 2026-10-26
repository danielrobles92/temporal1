package com.example.pets.petproject.domain.service;

import java.util.Optional;

/**
 * Puerto de salida hacia el ml-service (modulo de reconocimiento de imagenes).
 * Convierte los bytes de una imagen en su embedding (vector de caracteristicas).
 * Las implementaciones deben degradar de forma segura: si el ml-service no esta
 * disponible devuelven Optional.empty() en lugar de propagar la excepcion.
 */
public interface EmbeddingClient {

    /**
     * Genera el embedding de una imagen.
     *
     * @param imageBytes  contenido binario de la imagen
     * @param filename    nombre de archivo (informativo, ayuda al multipart)
     * @param contentType tipo MIME (image/jpeg, image/png, image/webp)
     * @return el vector de caracteristicas, o vacio si no se pudo generar
     */
    Optional<float[]> embed(byte[] imageBytes, String filename, String contentType);

    /**
     * Analiza una imagen: devuelve el embedding individual y la raza predicha
     * en una sola llamada (POST /analyze). Vacio si no se pudo.
     */
    Optional<ImageAnalysis> analyze(byte[] imageBytes, String filename, String contentType);

    /**
     * Describe al perro de la imagen (POST /describe): perro o no (y que es), raza
     * u "Otro", tamano, etapa y color. Vacio si el ml-service no respondio.
     */
    Optional<DogDescription> describe(byte[] imageBytes, String filename, String contentType);

    /** Indica si el ml-service responde (health check). */
    boolean isAvailable();
}
