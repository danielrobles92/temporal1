package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.core.DogImageGuard;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Analisis de una foto antes de publicar: el front la envia al elegirla para
 * avisar si no es un perro y sugerir raza (u "Otro"), tamano, etapa y color.
 */
@RestController
@RequestMapping("/images")
@CrossOrigin
public class ImageAnalysisController {

    private final DogImageGuard dogImageGuard;

    public ImageAnalysisController(DogImageGuard dogImageGuard) {
        this.dogImageGuard = dogImageGuard;
    }

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analyze(@RequestPart("image") MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Se requiere una imagen"));
        }
        return dogImageGuard.describe(image)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Map.of("message", "El reconocimiento de imagenes no esta disponible en este momento")));
    }
}
