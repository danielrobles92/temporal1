package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Notificacion dirigida a un usuario (mensaje en caso, decision, aviso, coincidencia). */
@Entity
@Table(name = "notifications")
@Getter
@Setter
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Integer notificationId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    /** CASE_MESSAGE, CASE_STATUS, ADOPTION_REQUEST, ADOPTION_DECISION,
     *  AUTHORIZATION_DECISION, SIGHTING, SIGHTING_REPLY, MATCH */
    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String message;

    /** Ruta del frontend a la que lleva la notificacion (p. ej. /casos). */
    @Column(length = 200)
    private String link;

    @Column(name = "is_read", nullable = false)
    private Boolean isRead = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
