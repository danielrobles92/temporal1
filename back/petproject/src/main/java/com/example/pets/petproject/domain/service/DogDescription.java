package com.example.pets.petproject.domain.service;

import java.util.List;

/**
 * Descripcion del perro de una foto generada por el ml-service (POST /describe,
 * modelo DogNet v2): si es un perro (o que es: gato, peluche, otro animal, objeto),
 * la raza entre las 20 del catalogo u "Otro" (otra raza o mestizo), tamano con
 * peso orientativo, etapa de vida (cachorro: menos de 1 año, o adulto) y color
 * del pelaje.
 *
 * Es una sugerencia del modelo, no una identificacion definitiva.
 */
public record DogDescription(
        boolean isDog,
        String animal,
        String notDogType,
        Float dogProbability,
        String message,
        String breed,
        Float breedConfidence,
        boolean inCatalog,
        List<BreedScore> breedTop,
        String size,
        Float sizeConfidence,
        Float weightMinKg,
        Float weightMaxKg,
        String age,
        Float ageConfidence,
        Float puppyProbability,
        String color,
        String colorSecondary,
        String colorLabel
) {

    /** Valor de raza para perros fuera del catalogo de 20 razas o mestizos. */
    public static final String OTHER_BREED = "Otro";

    public record BreedScore(String breed, Float score) {
    }

    /** true si la raza es una de las 20 del catalogo (no nula ni "Otro"). */
    public static boolean isCatalogBreed(String breed) {
        return breed != null && !breed.isBlank() && !OTHER_BREED.equalsIgnoreCase(breed.trim());
    }
}
