package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Embedding (vector de caracteristicas) de una imagen de mascota, generado por el
 * ml-service con EfficientNetB0. Una fila por imagen de pet_images.
 *
 * El vector se almacena como arreglo nativo REAL[] (sin pgvector en esta etapa).
 * Esta normalizado con norma L2, por lo que la similitud del coseno equivale al
 * producto punto y se calcula en el backend.
 */
@Entity
@Table(name = "pet_image_embeddings")
@Getter
@Setter
public class PetImageEmbeddingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "embedding_id")
    private Integer embeddingId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "image_id", nullable = false, unique = true)
    private ImageEntity image;

    @Column(nullable = false)
    private String model = "efficientnet_b0";

    @Column(nullable = false)
    private Integer dim = 1280;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "embedding", columnDefinition = "real[]", nullable = false)
    private float[] embedding;

    /** Raza predicha por el clasificador mx20 (filtro de matching). */
    @Column(length = 80)
    private String breed;

    @Column(name = "breed_confidence")
    private Float breedConfidence;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
