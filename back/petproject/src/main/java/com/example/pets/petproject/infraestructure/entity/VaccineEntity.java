package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Una vacuna registrada en la cartilla del perro. */
@Entity
@Table(name = "pet_vaccines")
@Getter
@Setter
public class VaccineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vaccine_id")
    private Integer vaccineId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "applied_at")
    private LocalDate appliedAt;

    @Column(name = "next_dose_at")
    private LocalDate nextDoseAt;

    @Column(length = 255)
    private String vet;

    @Column(length = 80)
    private String lot;

    @ManyToOne
    @JoinColumn(name = "pet_id")
    private PetsEntity pet;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
