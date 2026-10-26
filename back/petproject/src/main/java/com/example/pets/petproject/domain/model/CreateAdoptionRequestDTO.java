package com.example.pets.petproject.domain.model;

public record CreateAdoptionRequestDTO(
        Integer petId,
        Integer userId,
        String contactName,
        String contactEmail,
        String contactPhone,
        String message
) {}
