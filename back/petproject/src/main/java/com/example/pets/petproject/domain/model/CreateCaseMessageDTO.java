package com.example.pets.petproject.domain.model;

public record CreateCaseMessageDTO(
        Integer senderId,
        String message
) {
}
