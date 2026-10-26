package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.model.NotificationDTO;
import com.example.pets.petproject.domain.port.NotificationRepositoryDB;
import com.example.pets.petproject.infraestructure.entity.NotificationEntity;
import com.example.pets.petproject.security.AuthUtils;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@CrossOrigin
public class NotificationsController {

    private final NotificationRepositoryDB repository;

    public NotificationsController(NotificationRepositoryDB repository) {
        this.repository = repository;
    }

    @GetMapping("/user/{userId}")
    public List<NotificationDTO> getByUser(@PathVariable Integer userId) {
        requireSelfOrAdmin(userId);
        return repository.findTop50ByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toDto)
                .toList();
    }

    @GetMapping("/user/{userId}/unread-count")
    public Map<String, Long> unreadCount(@PathVariable Integer userId) {
        requireSelfOrAdmin(userId);
        return Map.of("unread", repository.countByUserIdAndIsReadFalse(userId));
    }

    @PatchMapping("/{id}/read")
    public NotificationDTO markRead(@PathVariable Integer id) {
        NotificationEntity n = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notificacion no encontrada"));
        requireSelfOrAdmin(n.getUserId());
        n.setIsRead(true);
        return toDto(repository.save(n));
    }

    @Transactional
    @PatchMapping("/user/{userId}/read-all")
    public Map<String, Integer> markAllRead(@PathVariable Integer userId) {
        requireSelfOrAdmin(userId);
        return Map.of("updated", repository.markAllRead(userId));
    }

    private void requireSelfOrAdmin(Integer userId) {
        if (!AuthUtils.isSelfOrAdmin(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }
    }

    private NotificationDTO toDto(NotificationEntity n) {
        return new NotificationDTO(n.getNotificationId(), n.getType(), n.getTitle(),
                n.getMessage(), n.getLink(), n.getIsRead(), n.getCreatedAt());
    }
}
