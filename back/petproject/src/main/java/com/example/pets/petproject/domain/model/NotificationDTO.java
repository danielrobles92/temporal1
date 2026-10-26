package com.example.pets.petproject.domain.model;

import java.time.LocalDateTime;

public record NotificationDTO(
        Integer notificationId,
        String type,
        String title,
        String message,
        String link,
        Boolean read,
        LocalDateTime createdAt
) {}
