package com.example.pets.petproject.domain.model;

import com.example.pets.petproject.domain.enums.AdoptionRequestStatus;

import java.time.LocalDateTime;

public record AdoptionRequestDTO(
        Integer requestId,
        Integer petId,
        String petName,
        String petImageUrl,
        String petBreed,
        String petOwnerName,
        Integer userId,
        String contactName,
        String contactEmail,
        String contactPhone,
        String message,
        AdoptionRequestStatus status,
        String decisionNotes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
