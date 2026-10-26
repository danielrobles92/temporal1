package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "pet_images")
@Getter
@Setter
public class ImageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Integer imageId;

    @Column(name = "url_image", nullable = false, columnDefinition = "TEXT")
    private String urlImage;

    @Column(name = "is_primary")
    private Boolean isPrimary;

    /** Orden de la foto (1..4); la principal es la 1. */
    @Column
    private Integer position;

    @ManyToOne
    @JoinColumn(name = "pet_id")
    private PetsEntity pet;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
