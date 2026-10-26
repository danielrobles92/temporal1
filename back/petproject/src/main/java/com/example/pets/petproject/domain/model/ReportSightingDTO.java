package com.example.pets.petproject.domain.model;

import java.time.LocalDateTime;
import java.util.List;

public record ReportSightingDTO(
        Integer sightingId,
        Integer reportId,
        Integer userId,
        String contactName,
        String contactEmail,
        String contactPhone,
        String location,
        String message,
        List<String> imageUrls,
        String status,
        String ownerReply,
        String reportName,
        Integer reportOwnerId,
        String reportOwnerName,
        LocalDateTime caseOpenedAt,
        LocalDateTime repliedAt,
        LocalDateTime createdAt
) {}
