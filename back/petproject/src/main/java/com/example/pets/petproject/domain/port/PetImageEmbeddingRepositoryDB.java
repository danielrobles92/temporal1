package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.PetImageEmbeddingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PetImageEmbeddingRepositoryDB extends JpaRepository<PetImageEmbeddingEntity, Integer> {

    /** Embeddings de todas las imagenes de un conjunto de mascotas (para el matching). */
    List<PetImageEmbeddingEntity> findByImage_Pet_PetIdIn(Collection<Integer> petIds);

    Optional<PetImageEmbeddingEntity> findByImage_ImageId(Integer imageId);

    boolean existsByImage_ImageId(Integer imageId);
}
