package com.example.pets.petproject.domain.model;

import com.example.pets.petproject.domain.enums.UserRole;

public record UserDTO (
        Integer id,
        String username,
        String email,
        String phone,
        UserRole role,
        Boolean publishingAuthorized,
        Boolean accountActive
) {

}
