package com.example.pets.petproject.domain.model;

public record LoginResponseDTO(
        boolean success,
        String message,
        String username,
        Boolean isAdmin,
        Integer id,
        String token,
        String role,
        Boolean publishingAuthorized
) {}
