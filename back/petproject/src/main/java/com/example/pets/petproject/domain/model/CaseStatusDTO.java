package com.example.pets.petproject.domain.model;

public record CaseStatusDTO(
        String status,
        Integer actorId,
        String message
) {
}
