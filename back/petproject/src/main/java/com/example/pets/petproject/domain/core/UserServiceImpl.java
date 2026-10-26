package com.example.pets.petproject.domain.core;

import com.example.pets.petproject.domain.enums.UserRole;
import com.example.pets.petproject.domain.mapper.UserMapper;
import com.example.pets.petproject.domain.model.CreateUserDTO;
import com.example.pets.petproject.domain.model.UserDTO;
import com.example.pets.petproject.domain.port.UserRepositoryDB;
import com.example.pets.petproject.domain.service.UserService;
import com.example.pets.petproject.infraestructure.entity.UserEntity;
import at.favre.lib.crypto.bcrypt.BCrypt;
import com.example.pets.petproject.utils.Constants;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepositoryDB repository;

    public UserServiceImpl(UserRepositoryDB repository) {
        this.repository = repository;
    }

    @Override
    public List<UserDTO> getAllUsers() {
        return repository.findAll()
                .stream()
                .map(UserMapper::toDto)
                .toList();
    }

    @Override
    public UserDTO createUser(CreateUserDTO dto) {
        String email = dto.email() == null ? "" : dto.email().trim().toLowerCase();

        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El correo electronico es requerido");
        }

        if (repository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este correo ya fue registrado");
        }

        UserEntity entity = UserMapper.toEntity(dto);
        entity.setEmail(email);

        // Hash password con BCrypt
        String hashed = BCrypt.withDefaults()
                .hashToString(12, dto.password().toCharArray());

        entity.setPassword(hashed);

        UserRole roleToAssign = (dto.role() != null) ? dto.role() : UserRole.USER;
        entity.setRole(roleToAssign);
        entity.setPublishingAuthorized(roleToAssign == UserRole.SHELTER || roleToAssign == UserRole.ADMIN);

        UserEntity saved = repository.save(entity);
        return UserMapper.toDto(saved);
    }

    @Override
    public void deleteUser(Integer id) {
        repository.deleteById(id);
    }

    @Override
    public UserDTO getByEmail(String email) {
        return repository.findByEmail(email)
                .map(UserMapper::toDto)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }

    @Override
    public UserDTO updateUser(Integer id, UserDTO dto) {
        UserEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Usuario no encontrado")
        );

        existing.setPhone(dto.phone());
        existing.setUsername(dto.username());

        UserEntity updated = repository.save(existing);
        return UserMapper.toDto(updated);
    }

    @Override
    @Transactional
    public UserDTO updatePassword(Integer id, String newPassword) {
        UserEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Usuario no encontrado")
        );

        // Hashear la nueva contraseña
        String hashed = BCrypt.withDefaults()
                .hashToString(12, newPassword.toCharArray());

        existing.setPassword(hashed);

        return UserMapper.toDto(repository.save(existing));
    }

    @Override
    public UserDTO updateRole(Integer id, String role) {
        UserEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Usuario no encontrado")
        );
        UserRole newRole = UserRole.valueOf(role);
        existing.setRole(newRole);
        if (newRole == UserRole.ADMIN || newRole == UserRole.SHELTER) {
            existing.setPublishingAuthorized(true);
        }
        return UserMapper.toDto(repository.save(existing));
    }

    @Override
    public UserDTO updatePublishingAuthorization(Integer id, Boolean authorized) {
        UserEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Usuario no encontrado")
        );
        existing.setPublishingAuthorized(Boolean.TRUE.equals(authorized));
        return UserMapper.toDto(repository.save(existing));
    }

    @Override
    public UserDTO updateAccountStatus(Integer id, Boolean active) {
        UserEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Usuario no encontrado")
        );
        existing.setAccountActive(Boolean.TRUE.equals(active));
        return UserMapper.toDto(repository.save(existing));
    }


}
