package com.example.pets.petproject.infraestructure.entity;

import com.example.pets.petproject.domain.enums.MatchStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Coincidencia potencial entre un reporte de extravio/hallazgo (lost_pets) y una
 * mascota registrada (pets). Persiste el resultado del modulo de coincidencias
 * para poder consultarlo y validarlo/rechazarlo (RF-31..RF-34).
 */
@Entity
@Table(name = "matches")
@Getter
@Setter
public class MatchEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "match_id")
    private Integer matchId;

    @Column(name = "report_id", nullable = false)
    private Integer reportId;

    /** Objetivo de la coincidencia: una mascota del catalogo... */
    @Column(name = "pet_id")
    private Integer petId;

    /** ...o bien otro reporte (perdido<->encontrado). Uno de los dos. */
    @Column(name = "matched_report_id")
    private Integer matchedReportId;

    /** Similitud del coseno del lado imagen (0..1). */
    @Column(name = "visual_score")
    private Float visualScore;

    /** Puntaje por reglas (raza/sexo/color/ubicacion). */
    @Column(name = "attribute_score")
    private Integer attributeScore;

    /** Puntaje hibrido final usado para ordenar las coincidencias. */
    @Column(nullable = false)
    private Float score;

    /** Probabilidad calibrada [0,1] de ser el mismo perro (visual + filtro de raza). */
    @Column
    private Float confidence;

    @Column(length = 500)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MatchStatus status = MatchStatus.SUGGESTED;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
