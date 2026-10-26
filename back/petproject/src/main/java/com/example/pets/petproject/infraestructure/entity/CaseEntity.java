package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "cases")
@Getter
@Setter
public class CaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "case_id")
    private Integer caseId;

    @Column(name = "case_type", nullable = false, length = 30)
    private String caseType;

    @Column(nullable = false, length = 30)
    private String status = "OPEN";

    @Column(name = "pet_id")
    private Integer petId;

    @Column(name = "report_id")
    private Integer reportId;

    @Column(name = "adoption_request_id")
    private Integer adoptionRequestId;

    @Column(name = "report_sighting_id")
    private Integer reportSightingId;

    @Column(name = "owner_id", nullable = false)
    private Integer ownerId;

    @Column(name = "participant_id")
    private Integer participantId;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(name = "last_message", length = 2000)
    private String lastMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
