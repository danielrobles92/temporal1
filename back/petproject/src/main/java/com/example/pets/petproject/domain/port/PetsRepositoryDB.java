package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.domain.enums.PetStatus;
import com.example.pets.petproject.infraestructure.entity.PetsEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PetsRepositoryDB extends JpaRepository<PetsEntity, Integer> {

    Page<PetsEntity> findByStatus(PetStatus status, Pageable pageable);

    List<PetsEntity> findByOwnerId(Integer ownerId);
}
