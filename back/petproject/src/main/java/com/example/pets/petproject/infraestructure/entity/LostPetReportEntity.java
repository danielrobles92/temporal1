package com.example.pets.petproject.infraestructure.entity;

import com.example.pets.petproject.domain.enums.*;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "lost_pets")
@Getter
@Setter
public class LostPetReportEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_id")
    private Integer reportId;

    @Column(name = "reporter_id", nullable = false)
    private Integer reporterId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportType type;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PetSpecies species;

    private String breed;

    @Enumerated(EnumType.STRING)
    private PetSex sex;

    private String color;

    private Integer age;

    @Column(nullable = false, length = 500)
    private String location;

    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Column(length = 1000)
    private String description;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportStatus status = ReportStatus.OPEN;

    @Column(name = "moderation_notes", length = 1000)
    private String moderationNotes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
