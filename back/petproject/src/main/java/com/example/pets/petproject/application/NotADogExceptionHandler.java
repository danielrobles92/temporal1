package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.core.DogImageGuard;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Cuando una foto subida no es de un perro responde 422 con {message} para que el
 * front muestre el aviso ("La imagen no se identifica como un perro ...").
 */
@RestControllerAdvice
public class NotADogExceptionHandler {

    @ExceptionHandler(DogImageGuard.NotADogException.class)
    public ResponseEntity<Map<String, String>> handle(DogImageGuard.NotADogException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of(
                "message", e.getMessage(),
                "error", "NOT_A_DOG",
                "detected", e.getDetectedType() != null ? e.getDetectedType() : ""));
    }
}
