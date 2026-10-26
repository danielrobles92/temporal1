package com.example.pets.petproject.domain.model;

public record CreateAuthorizationRequestDTO(
        Integer userId,
        String reason
) {}
