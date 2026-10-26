package com.example.pets.petproject.domain.model;

import java.time.LocalDate;

/** Vacuna de la cartilla. */
public record VaccineDTO(
        Integer vaccineId,
        String name,
        LocalDate appliedAt,
        LocalDate nextDoseAt,
        String vet,
        String lot
) {}
