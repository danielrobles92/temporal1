package com.example.pets.petproject.domain.model;

import java.time.LocalDateTime;
import java.util.List;

public record CaseDTO(
        Integer caseId,
        String caseType,
        String status,
        Integer petId,
        Integer reportId,
        Integer adoptionRequestId,
        Integer reportSightingId,
        Integer ownerId,
        String ownerName,
        String ownerEmail,
        Integer participantId,
        String participantName,
        String participantEmail,
        String participantPhone,
        String title,
        String petName,
        String imageUrl,
        String location,
        String description,
        String lastMessage,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<CaseMessageDTO> messages
) {
}
