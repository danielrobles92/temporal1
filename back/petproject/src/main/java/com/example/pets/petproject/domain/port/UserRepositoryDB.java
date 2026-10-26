package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepositoryDB extends JpaRepository<UserEntity, Integer> {

    Optional<UserEntity> findByEmail(String email);

}
