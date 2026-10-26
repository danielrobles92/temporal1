package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.core.NotificationService;
import com.example.pets.petproject.domain.enums.AuthorizationRequestStatus;
import com.example.pets.petproject.domain.model.AuthorizationRequestDTO;
import com.example.pets.petproject.domain.model.CreateAuthorizationRequestDTO;
import com.example.pets.petproject.domain.model.ModerationDTO;
import com.example.pets.petproject.domain.port.AuthorizationRequestRepositoryDB;
import com.example.pets.petproject.domain.port.UserRepositoryDB;
import com.example.pets.petproject.infraestructure.entity.PublicationAuthorizationRequestEntity;
import com.example.pets.petproject.infraestructure.entity.UserEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/publication-authorizations")
@CrossOrigin
public class AuthorizationController {

    private final AuthorizationRequestRepositoryDB repository;
    private final UserRepositoryDB userRepository;
    private final NotificationService notificationService;

    public AuthorizationController(AuthorizationRequestRepositoryDB repository, UserRepositoryDB userRepository,
                                   NotificationService notificationService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<AuthorizationRequestDTO> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @GetMapping("/user/{userId}")
    public List<AuthorizationRequestDTO> getByUser(@PathVariable Integer userId) {
        return repository.findByUserId(userId).stream().map(this::toDto).toList();
    }

    @PostMapping
    public AuthorizationRequestDTO create(@RequestBody CreateAuthorizationRequestDTO dto) {
        UserEntity user = userRepository.findById(dto.userId())
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        if (Boolean.TRUE.equals(user.getPublishingAuthorized())
                || repository.existsByUserIdAndStatus(dto.userId(), AuthorizationRequestStatus.PENDING)) {
            throw new RuntimeException("El usuario ya cuenta con autorizacion o tiene una solicitud pendiente");
        }

        PublicationAuthorizationRequestEntity entity = new PublicationAuthorizationRequestEntity();
        entity.setUserId(dto.userId());
        entity.setReason(dto.reason());
        return toDto(repository.save(entity));
    }

    @PatchMapping("/{id}/decision")
    public AuthorizationRequestDTO decide(@PathVariable Integer id, @RequestBody ModerationDTO dto) {
        PublicationAuthorizationRequestEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Solicitud de autorizacion no encontrada"));
        AuthorizationRequestStatus status = AuthorizationRequestStatus.valueOf(dto.status());
        entity.setStatus(status);
        entity.setReviewNotes(dto.notes());
        entity.setUpdatedAt(LocalDateTime.now());

        UserEntity user = userRepository.findById(entity.getUserId())
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        user.setPublishingAuthorized(status == AuthorizationRequestStatus.APPROVED);
        userRepository.save(user);

        // Notificar la decision al usuario.
        notificationService.notify(entity.getUserId(), "AUTHORIZATION_DECISION",
                status == AuthorizationRequestStatus.APPROVED
                        ? "Tu permiso para publicar fue aprobado"
                        : "Tu solicitud de permiso fue rechazada",
                dto.notes(), "/perfil");

        return toDto(repository.save(entity));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Integer id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Solicitud de autorizacion no encontrada");
        }
        repository.deleteById(id);
    }

    private AuthorizationRequestDTO toDto(PublicationAuthorizationRequestEntity e) {
        UserEntity user = userRepository.findById(e.getUserId()).orElse(null);
        return new AuthorizationRequestDTO(
                e.getAuthorizationId(),
                e.getUserId(),
                user != null ? user.getUsername() : null,
                user != null ? user.getEmail() : null,
                e.getReason(),
                e.getStatus(),
                e.getReviewNotes(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
