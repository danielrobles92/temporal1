package com.example.pets.petproject.domain.model;

import com.example.pets.petproject.domain.enums.UserRole;

public record CreateUserDTO(
        String username,
        String email,
        String phone,
        String password,
        UserRole role
) {}
