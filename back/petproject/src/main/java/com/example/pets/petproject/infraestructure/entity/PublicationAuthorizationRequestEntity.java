package com.example.pets.petproject.infraestructure.entity;

import com.example.pets.petproject.domain.enums.AuthorizationRequestStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "publication_authorization_requests")
@Getter
@Setter
public class PublicationAuthorizationRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "authorization_id")
    private Integer authorizationId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(length = 1000)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuthorizationRequestStatus status = AuthorizationRequestStatus.PENDING;

    @Column(name = "review_notes", length = 1000)
    private String reviewNotes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
