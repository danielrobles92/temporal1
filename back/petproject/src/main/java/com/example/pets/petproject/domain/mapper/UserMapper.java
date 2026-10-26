package com.example.pets.petproject.domain.mapper;

import com.example.pets.petproject.domain.enums.UserRole;
import com.example.pets.petproject.domain.model.CreateUserDTO;
import com.example.pets.petproject.domain.model.UserDTO;
import com.example.pets.petproject.infraestructure.entity.UserEntity;

import java.time.LocalDateTime;

public class UserMapper {

    public static UserDTO toDto(UserEntity u) {
        return new UserDTO(
                u.getId(),
                u.getUsername(),
                u.getEmail(),
                u.getPhone(),
                u.getRole(),
                u.getPublishingAuthorized(),
                u.getAccountActive()
        );
    }

    public static UserEntity toEntity(CreateUserDTO dto) {
        UserEntity u = new UserEntity();
        u.setUsername(dto.username());
        u.setEmail(dto.email());
        u.setPhone(dto.phone());
        u.setCreatedAt(LocalDateTime.now());
        u.setRole(UserRole.USER);
        u.setPublishingAuthorized(dto.role() == UserRole.SHELTER || dto.role() == UserRole.ADMIN);
        u.setAccountActive(true);
        return u;
    }

}
