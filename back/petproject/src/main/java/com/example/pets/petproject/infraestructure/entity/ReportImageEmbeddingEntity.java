package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Embedding (vector individual) + raza predicha de la imagen de un reporte de
 * extravio/hallazgo. Permite comparar reportes entre si (perdido<->encontrado)
 * y contra el catalogo de mascotas. Una fila por reporte.
 */
@Entity
@Table(name = "report_image_embeddings")
@Getter
@Setter
public class ReportImageEmbeddingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "embedding_id")
    private Integer embeddingId;

    @Column(name = "report_id", nullable = false, unique = true)
    private Integer reportId;

    @Column(nullable = false)
    private String model = "efficientnet_b0";

    @Column(nullable = false)
    private Integer dim = 1280;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "embedding", columnDefinition = "real[]", nullable = false)
    private float[] embedding;

    @Column(length = 80)
    private String breed;

    @Column(name = "breed_confidence")
    private Float breedConfidence;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
