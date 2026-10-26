package com.example.pets.petproject.infraestructure.entity;

import com.example.pets.petproject.domain.enums.AdoptionRequestStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "adoption_requests")
@Getter
@Setter
public class AdoptionRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "request_id")
    private Integer requestId;

    @Column(name = "pet_id", nullable = false)
    private Integer petId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "contact_name", nullable = false)
    private String contactName;

    @Column(name = "contact_email", nullable = false)
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(length = 1000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AdoptionRequestStatus status = AdoptionRequestStatus.PENDING;

    @Column(name = "decision_notes", length = 1000)
    private String decisionNotes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
