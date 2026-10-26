package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "case_messages")
@Getter
@Setter
public class CaseMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Integer messageId;

    @Column(name = "case_id", nullable = false)
    private Integer caseId;

    @Column(name = "sender_id")
    private Integer senderId;

    @Column(name = "sender_name", length = 150)
    private String senderName;

    @Column(nullable = false, length = 2000)
    private String message;

    @Column(name = "image_urls", columnDefinition = "TEXT")
    private String imageUrls;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
