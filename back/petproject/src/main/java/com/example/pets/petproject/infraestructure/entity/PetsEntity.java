package com.example.pets.petproject.infraestructure.entity;

import com.example.pets.petproject.domain.enums.PetSex;
import com.example.pets.petproject.domain.enums.PetSpecies;
import com.example.pets.petproject.domain.enums.PetStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.type.PostgreSQLEnumJdbcType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Entity
@Table(name = "pets")
@Getter
@Setter
public class PetsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "pet_id")
    private Integer petId;

    @Column(nullable = true)
    private Integer ownerId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "species")
    private PetSpecies species;

    @Column(nullable = false)
    private String breed;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "sex")
    private PetSex sex;

    @Column(nullable = false)
    private String color;

    @Column(nullable = false)
    private Integer age;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, length = 500)
    private String location;

    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(nullable = false, columnDefinition = "status")
    private PetStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // --- Cartilla / datos de salud ---
    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "weight_kg")
    private Double weightKg;

    @Column
    private Boolean sterilized;

    @Column(length = 60)
    private String microchip;

    @Column(name = "dewormed_at")
    private LocalDate dewormedAt;

    @Column(name = "vet_name")
    private String vetName;

    @Column(name = "medical_notes", length = 1000)
    private String medicalNotes;

    @OneToMany(mappedBy = "pet", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<VaccineEntity> vaccines;

    @OneToMany(mappedBy = "pet", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<ImageEntity> images;

}
