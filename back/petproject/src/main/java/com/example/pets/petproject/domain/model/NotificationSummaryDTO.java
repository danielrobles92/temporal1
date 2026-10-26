package com.example.pets.petproject.domain.model;

public record NotificationSummaryDTO(
        long adoptionRequests,
        long reportSightings,
        long openCases,
        long total
) {
}
