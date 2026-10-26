package com.example.pets.petproject.domain.core;

import com.example.pets.petproject.domain.service.DogDescription;
import com.example.pets.petproject.domain.service.EmbeddingClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Verifica con el ml-service que las fotos subidas sean de un perro antes de
 * guardarlas (publicar/editar mascota, reporte o avistamiento). Si una foto es
 * un gato, un peluche, otro animal o un objeto, lanza {@link NotADogException}
 * con el mensaje para el usuario.
 *
 * Degrada de forma segura: si el ml-service no responde, no se bloquea el flujo
 * (el reconocimiento es una herramienta de apoyo, no un requisito).
 */
@Service
@Slf4j
public class DogImageGuard {

    private final EmbeddingClient embeddingClient;

    public DogImageGuard(EmbeddingClient embeddingClient) {
        this.embeddingClient = embeddingClient;
    }

    /** Describe una foto (raza u Otro, tamano, etapa, color). Vacio si no se pudo analizar. */
    public Optional<DogDescription> describe(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return Optional.empty();
        }
        try {
            return embeddingClient.describe(file.getBytes(), file.getOriginalFilename(), file.getContentType());
        } catch (IOException e) {
            log.warn("No se pudo leer la imagen {}: {}", file.getOriginalFilename(), e.getMessage());
            return Optional.empty();
        }
    }

    /** Lanza NotADogException si alguna de las fotos no es de un perro. */
    public void requireDogs(List<MultipartFile> files) {
        if (files == null) {
            return;
        }
        int index = 0;
        for (MultipartFile file : files) {
            index++;
            if (file == null || file.isEmpty()) {
                continue;
            }
            final int photo = index;
            describe(file).filter(d -> !d.isDog()).ifPresent(d -> {
                String detail = d.message() != null ? d.message()
                        : "La imagen no se identifica como un perro. No se puede procesar.";
                String prefix = files.size() > 1 ? "Foto " + photo + ": " : "";
                throw new NotADogException(prefix + detail, d.notDogType());
            });
        }
    }

    public void requireDog(MultipartFile file) {
        if (file != null) {
            requireDogs(List.of(file));
        }
    }

    /** La foto no es de un perro: no se puede procesar. */
    public static class NotADogException extends RuntimeException {
        private final String detectedType;

        public NotADogException(String message, String detectedType) {
            super(message);
            this.detectedType = detectedType;
        }

        public String getDetectedType() {
            return detectedType;
        }
    }
}
