package com.example.pets.petproject.domain.model;

import java.time.LocalDateTime;
import java.util.List;

public record CaseMessageDTO(
        Integer messageId,
        Integer caseId,
        Integer senderId,
        String senderName,
        String message,
        List<String> imageUrls,
        LocalDateTime createdAt
) {
}
