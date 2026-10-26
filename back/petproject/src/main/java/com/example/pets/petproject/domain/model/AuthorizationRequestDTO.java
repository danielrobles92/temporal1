package com.example.pets.petproject.domain.model;

import com.example.pets.petproject.domain.enums.AuthorizationRequestStatus;

import java.time.LocalDateTime;

public record AuthorizationRequestDTO(
        Integer authorizationId,
        Integer userId,
        String username,
        String userEmail,
        String reason,
        AuthorizationRequestStatus status,
        String reviewNotes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
