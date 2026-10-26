package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.core.NotificationService;
import com.example.pets.petproject.domain.enums.AdoptionRequestStatus;
import com.example.pets.petproject.domain.model.AdoptionRequestDTO;
import com.example.pets.petproject.domain.model.CreateAdoptionRequestDTO;
import com.example.pets.petproject.domain.model.ModerationDTO;
import com.example.pets.petproject.domain.port.AdoptionRequestRepositoryDB;
import com.example.pets.petproject.domain.port.PetsRepositoryDB;
import com.example.pets.petproject.domain.port.UserRepositoryDB;
import com.example.pets.petproject.infraestructure.entity.AdoptionRequestEntity;
import com.example.pets.petproject.infraestructure.entity.ImageEntity;
import com.example.pets.petproject.infraestructure.entity.PetsEntity;
import com.example.pets.petproject.security.AuthUtils;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/adoption-requests")
@CrossOrigin
public class AdoptionRequestController {

    private final AdoptionRequestRepositoryDB repository;
    private final PetsRepositoryDB petsRepository;
    private final UserRepositoryDB userRepository;
    private final NotificationService notificationService;

    public AdoptionRequestController(AdoptionRequestRepositoryDB repository, PetsRepositoryDB petsRepository,
                                     UserRepositoryDB userRepository, NotificationService notificationService) {
        this.repository = repository;
        this.petsRepository = petsRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<AdoptionRequestDTO> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @GetMapping("/user/{userId}")
    public List<AdoptionRequestDTO> getByUser(@PathVariable Integer userId) {
        return repository.findByUserId(userId).stream().map(this::toDto).toList();
    }

    @GetMapping("/owner/{ownerId}")
    public List<AdoptionRequestDTO> getByOwner(@PathVariable Integer ownerId) {
        List<Integer> petIds = petsRepository.findByOwnerId(ownerId)
                .stream()
                .map(pet -> pet.getPetId())
                .toList();
        if (petIds.isEmpty()) {
            return List.of();
        }
        return repository.findByPetIdIn(petIds).stream().map(this::toDto).toList();
    }

    @PostMapping
    public AdoptionRequestDTO create(@RequestBody CreateAdoptionRequestDTO dto) {
        // RN-01: el solicitante es el usuario autenticado (no se confia en el cliente).
        Integer userId = AuthUtils.currentUserId() != null ? AuthUtils.currentUserId() : dto.userId();

        if (repository.existsByPetIdAndUserId(dto.petId(), userId)) {
            throw new RuntimeException("Ya realizaste una solicitud para este perro");
        }

        petsRepository.findById(dto.petId()).ifPresent(pet -> {
            if (pet.getOwnerId() != null && pet.getOwnerId().equals(userId)) {
                throw new RuntimeException("No puedes solicitar adopcion de tu propia publicacion");
            }
        });

        AdoptionRequestEntity entity = new AdoptionRequestEntity();
        entity.setPetId(dto.petId());
        entity.setUserId(userId);
        entity.setContactName(dto.contactName());
        entity.setContactEmail(dto.contactEmail());
        entity.setContactPhone(dto.contactPhone());
        entity.setMessage(dto.message());
        AdoptionRequestDTO saved = toDto(repository.save(entity));

        // Notificar al duenio de la publicacion.
        petsRepository.findById(dto.petId()).ifPresent(pet ->
                notificationService.notify(pet.getOwnerId(), "ADOPTION_REQUEST",
                        "Nueva solicitud de adopcion para " + pet.getName(),
                        dto.contactName() + " quiere adoptar a " + pet.getName(),
                        "/solicitudes"));
        return saved;
    }

    @DeleteMapping("/{id}/cancel")
    public void cancel(@PathVariable Integer id) {
        cancelRequest(id);
    }

    @DeleteMapping("/{id}")
    public void cancelByDelete(@PathVariable Integer id) {
        cancelRequest(id);
    }

    @DeleteMapping("/{id}/admin")
    public void deleteByAdmin(@PathVariable Integer id) {
        if (!AuthUtils.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo un administrador puede eliminar");
        }
        if (!repository.existsById(id)) {
            throw new RuntimeException("Solicitud de adopcion no encontrada");
        }
        repository.deleteById(id);
    }

    @PostMapping("/{id}/cancel")
    public void cancelByPost(@PathVariable Integer id) {
        cancelRequest(id);
    }

    /** Solo quien creo la solicitud (o un admin) puede cancelarla. */
    private void cancelRequest(Integer id) {
        AdoptionRequestEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Solicitud de adopcion no encontrada"));
        if (!AuthUtils.isSelfOrAdmin(entity.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo quien creo la solicitud puede cancelarla");
        }
        if (entity.getStatus() != AdoptionRequestStatus.PENDING) {
            throw new RuntimeException("Solo puedes cancelar solicitudes pendientes");
        }
        repository.deleteById(id);
    }

    @PatchMapping("/{id}/decision")
    public AdoptionRequestDTO decide(@PathVariable Integer id, @RequestBody ModerationDTO dto) {
        AdoptionRequestEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Solicitud de adopcion no encontrada"));

        // RN-10: solo el duenio de la publicacion (o un admin) puede aprobar/rechazar.
        PetsEntity pet = petsRepository.findById(entity.getPetId()).orElse(null);
        Integer ownerId = pet != null ? pet.getOwnerId() : null;
        if (!AuthUtils.isSelfOrAdmin(ownerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Solo el responsable de la publicacion puede decidir la solicitud");
        }

        entity.setStatus(AdoptionRequestStatus.valueOf(dto.status()));
        entity.setDecisionNotes(dto.notes());
        entity.setUpdatedAt(LocalDateTime.now());
        AdoptionRequestDTO result = toDto(repository.save(entity));

        // Notificar la decision al solicitante.
        String decision = entity.getStatus() == AdoptionRequestStatus.APPROVED ? "aprobada"
                : entity.getStatus() == AdoptionRequestStatus.REJECTED ? "rechazada"
                : entity.getStatus().name().toLowerCase();
        notificationService.notify(entity.getUserId(), "ADOPTION_DECISION",
                "Tu solicitud de adopcion fue " + decision,
                result.petName() != null ? "Solicitud sobre " + result.petName() : null,
                "/solicitudes");
        return result;
    }

    private AdoptionRequestDTO toDto(AdoptionRequestEntity e) {
        PetsEntity pet = petsRepository.findById(e.getPetId()).orElse(null);
        String petName = pet != null ? pet.getName() : null;
        String petOwnerName = pet != null && pet.getOwnerId() != null
                ? userRepository.findById(pet.getOwnerId()).map(user -> user.getUsername()).orElse(null)
                : null;
        String petImageUrl = pet != null && pet.getImages() != null && !pet.getImages().isEmpty()
                ? pet.getImages().stream()
                        .filter(image -> Boolean.TRUE.equals(image.getIsPrimary()))
                        .findFirst()
                        .or(() -> pet.getImages().stream().findFirst())
                        .map(ImageEntity::getUrlImage)
                        .orElse(null)
                : null;

        return new AdoptionRequestDTO(
                e.getRequestId(),
                e.getPetId(),
                petName,
                petImageUrl,
                pet != null ? pet.getBreed() : null,
                petOwnerName,
                e.getUserId(),
                e.getContactName(),
                e.getContactEmail(),
                e.getContactPhone(),
                e.getMessage(),
                e.getStatus(),
                e.getDecisionNotes(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
