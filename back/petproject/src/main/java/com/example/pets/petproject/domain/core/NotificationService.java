package com.example.pets.petproject.domain.core;

import com.example.pets.petproject.domain.port.NotificationRepositoryDB;
import com.example.pets.petproject.infraestructure.entity.NotificationEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Creacion de notificaciones dirigidas a un usuario. Degrada de forma segura:
 * si algo falla al notificar, no se interrumpe el flujo principal.
 */
@Service
@Slf4j
public class NotificationService {

    private final NotificationRepositoryDB repository;

    public NotificationService(NotificationRepositoryDB repository) {
        this.repository = repository;
    }

    public void notify(Integer userId, String type, String title, String message, String link) {
        if (userId == null) {
            return;
        }
        try {
            NotificationEntity n = new NotificationEntity();
            n.setUserId(userId);
            n.setType(type);
            n.setTitle(title != null && title.length() > 200 ? title.substring(0, 200) : title);
            n.setMessage(message != null && message.length() > 500 ? message.substring(0, 500) : message);
            n.setLink(link);
            repository.save(n);
        } catch (Exception e) {
            log.warn("No se pudo crear la notificacion para el usuario {}: {}", userId, e.getMessage());
        }
    }
}
