package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.AdoptionRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AdoptionRequestRepositoryDB extends JpaRepository<AdoptionRequestEntity, Integer> {
    List<AdoptionRequestEntity> findByUserId(Integer userId);
    List<AdoptionRequestEntity> findByPetIdIn(List<Integer> petIds);
    Optional<AdoptionRequestEntity> findByPetIdAndUserId(Integer petId, Integer userId);
    boolean existsByPetIdAndUserId(Integer petId, Integer userId);
}
