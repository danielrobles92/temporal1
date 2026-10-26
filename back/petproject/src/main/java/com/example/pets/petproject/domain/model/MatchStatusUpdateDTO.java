package com.example.pets.petproject.domain.model;

/** Cambio de estado de una coincidencia (RF-34): VALIDATED, REJECTED o DISCARDED. */
public record MatchStatusUpdateDTO(String status) {}
