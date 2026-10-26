package com.example.pets.petproject.domain.model;

import com.example.pets.petproject.domain.enums.*;

import java.time.LocalDateTime;

public record LostPetReportDTO(
        Integer reportId,
        Integer reporterId,
        String reporterName,
        String reporterEmail,
        ReportType type,
        String name,
        PetSpecies species,
        String breed,
        PetSex sex,
        String color,
        Integer age,
        String location,
        Double latitude,
        Double longitude,
        String description,
        String contactPhone,
        String imageUrl,
        ReportStatus status,
        String moderationNotes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
