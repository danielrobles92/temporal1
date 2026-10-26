package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.enums.AdoptionRequestStatus;
import com.example.pets.petproject.domain.enums.PetStatus;
import com.example.pets.petproject.domain.enums.ReportStatus;
import com.example.pets.petproject.domain.model.CaseDTO;
import com.example.pets.petproject.domain.model.CaseMessageDTO;
import com.example.pets.petproject.domain.model.CaseStatusDTO;
import com.example.pets.petproject.domain.model.CreateCaseMessageDTO;
import com.example.pets.petproject.domain.core.NotificationService;
import com.example.pets.petproject.domain.model.NotificationSummaryDTO;
import com.example.pets.petproject.domain.port.*;
import com.example.pets.petproject.domain.service.ImageStorageService;
import com.example.pets.petproject.infraestructure.entity.*;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/cases")
@CrossOrigin
public class CasesController {

    private final CaseRepositoryDB caseRepository;
    private final CaseMessageRepositoryDB messageRepository;
    private final AdoptionRequestRepositoryDB adoptionRequestRepository;
    private final ReportSightingRepositoryDB sightingRepository;
    private final LostPetReportRepositoryDB reportRepository;
    private final PetsRepositoryDB petsRepository;
    private final UserRepositoryDB userRepository;
    private final ImageStorageService imageStorageService;
    private final NotificationService notificationService;

    public CasesController(
            CaseRepositoryDB caseRepository,
            CaseMessageRepositoryDB messageRepository,
            AdoptionRequestRepositoryDB adoptionRequestRepository,
            ReportSightingRepositoryDB sightingRepository,
            LostPetReportRepositoryDB reportRepository,
            PetsRepositoryDB petsRepository,
            UserRepositoryDB userRepository,
            ImageStorageService imageStorageService,
            NotificationService notificationService
    ) {
        this.caseRepository = caseRepository;
        this.messageRepository = messageRepository;
        this.adoptionRequestRepository = adoptionRequestRepository;
        this.sightingRepository = sightingRepository;
        this.reportRepository = reportRepository;
        this.petsRepository = petsRepository;
        this.userRepository = userRepository;
        this.imageStorageService = imageStorageService;
        this.notificationService = notificationService;
    }

    /** Notifica al otro participante del caso (el que no realizo la accion). */
    private void notifyCounterpart(CaseEntity caseEntity, Integer actorId, String type, String title, String message) {
        Integer recipient = actorId != null && actorId.equals(caseEntity.getOwnerId())
                ? caseEntity.getParticipantId()
                : caseEntity.getOwnerId();
        if (recipient != null && !recipient.equals(actorId)) {
            notificationService.notify(recipient, type, title, message, "/casos");
        }
    }

    @GetMapping("/user/{userId}")
    public List<CaseDTO> getByUser(@PathVariable Integer userId) {
        return caseRepository.findByOwnerIdOrParticipantIdOrderByUpdatedAtDesc(userId, userId)
                .stream()
                .map(caseEntity -> toDto(caseEntity, true))
                .toList();
    }

    @GetMapping
    public List<CaseDTO> getAll() {
        return caseRepository.findAll().stream()
                .sorted(Comparator.comparing(CaseEntity::getUpdatedAt).reversed())
                .map(caseEntity -> toDto(caseEntity, true))
                .toList();
    }

    @GetMapping("/{caseId}")
    public CaseDTO getById(@PathVariable Integer caseId) {
        return caseRepository.findById(caseId)
                .map(caseEntity -> toDto(caseEntity, true))
                .orElseThrow(() -> new RuntimeException("Caso no encontrado"));
    }

    @PostMapping("/adoption/{requestId}")
    public CaseDTO createAdoptionCase(@PathVariable Integer requestId) {
        return caseRepository.findByAdoptionRequestId(requestId)
                .map(caseEntity -> toDto(caseEntity, true))
                .orElseGet(() -> createAdoptionCaseInternal(requestId));
    }

    @PostMapping("/sighting/{sightingId}")
    public CaseDTO createSightingCase(@PathVariable Integer sightingId) {
        return caseRepository.findByReportSightingId(sightingId)
                .map(caseEntity -> toDto(caseEntity, true))
                .orElseGet(() -> createSightingCaseInternal(sightingId));
    }

    @PostMapping("/{caseId}/messages")
    public CaseDTO addMessage(@PathVariable Integer caseId, @RequestBody CreateCaseMessageDTO dto) {
        return addMessageInternal(caseId, dto.senderId(), dto.message(), List.of());
    }

    @PostMapping(value = "/{caseId}/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CaseDTO addMessageWithImages(
            @PathVariable Integer caseId,
            @RequestPart("message") CreateCaseMessageDTO dto,
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        List<String> imagePaths = images == null ? List.of() : images.stream()
                .map(imageStorageService::storeCaseMessageImage)
                .filter(path -> path != null && !path.isBlank())
                .toList();
        return addMessageInternal(caseId, dto.senderId(), dto.message(), imagePaths);
    }

    private CaseDTO addMessageInternal(Integer caseId, Integer senderId, String messageText, List<String> imagePaths) {
        CaseEntity caseEntity = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Caso no encontrado"));
        boolean hasMessage = messageText != null && !messageText.isBlank();
        boolean hasImages = imagePaths != null && !imagePaths.isEmpty();
        if (!hasMessage && !hasImages) {
            throw new IllegalArgumentException("El mensaje o las imagenes son requeridos");
        }

        CaseMessageEntity message = new CaseMessageEntity();
        message.setCaseId(caseId);
        message.setSenderId(senderId);
        message.setSenderName(resolveUserName(senderId));
        message.setMessage(hasMessage ? messageText.trim() : "Fotos adjuntas");
        message.setImageUrls(joinImageUrls(imagePaths));
        messageRepository.save(message);

        caseEntity.setLastMessage(hasMessage ? messageText.trim() : "Fotos adjuntas");
        caseEntity.setUpdatedAt(LocalDateTime.now());
        caseRepository.save(caseEntity);

        // Notificar al otro participante del caso.
        notifyCounterpart(caseEntity, senderId, "CASE_MESSAGE",
                "Nuevo mensaje en: " + caseEntity.getTitle(),
                hasMessage ? messageText.trim() : "Te enviaron fotos");

        return toDto(caseEntity, true);
    }

    @PatchMapping("/{caseId}/status")
    public CaseDTO updateStatus(@PathVariable Integer caseId, @RequestBody CaseStatusDTO dto) {
        CaseEntity caseEntity = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Caso no encontrado"));
        if (dto.status() == null || dto.status().isBlank()) {
            throw new IllegalArgumentException("El estado es requerido");
        }

        caseEntity.setStatus(dto.status());
        caseEntity.setUpdatedAt(LocalDateTime.now());
        if (dto.message() != null && !dto.message().isBlank()) {
            CaseMessageEntity message = new CaseMessageEntity();
            message.setCaseId(caseId);
            message.setSenderId(dto.actorId());
            message.setSenderName(resolveUserName(dto.actorId()));
            message.setMessage(dto.message().trim());
            messageRepository.save(message);
            caseEntity.setLastMessage(dto.message().trim());
        }

        if ("ADOPTED".equals(dto.status()) && caseEntity.getPetId() != null) {
            petsRepository.findById(caseEntity.getPetId()).ifPresent(pet -> {
                pet.setStatus(PetStatus.ADOPTED);
                petsRepository.save(pet);
            });
        }

        if ("RESOLVED".equals(dto.status()) && caseEntity.getReportId() != null) {
            reportRepository.findById(caseEntity.getReportId()).ifPresent(report -> {
                report.setStatus(ReportStatus.RESOLVED);
                report.setUpdatedAt(LocalDateTime.now());
                reportRepository.save(report);
            });
        }

        // Notificar el cambio de estado al otro participante.
        notifyCounterpart(caseEntity, dto.actorId(), "CASE_STATUS",
                "Caso actualizado: " + caseEntity.getTitle(),
                "Nuevo estado: " + dto.status());

        return toDto(caseRepository.save(caseEntity), true);
    }

    @DeleteMapping("/{caseId}")
    public void deleteCase(@PathVariable Integer caseId) {
        if (!caseRepository.existsById(caseId)) {
            throw new RuntimeException("Caso no encontrado");
        }
        caseRepository.deleteById(caseId);
    }

    @GetMapping("/notifications/{userId}")
    public NotificationSummaryDTO getNotifications(@PathVariable Integer userId) {
        List<Integer> petIds = petsRepository.findByOwnerId(userId).stream()
                .map(PetsEntity::getPetId)
                .toList();
        long adoptionRequests = petIds.isEmpty() ? 0 : adoptionRequestRepository.findByPetIdIn(petIds).stream()
                .filter(request -> request.getStatus() == AdoptionRequestStatus.PENDING)
                .count();
        long sightings = reportRepository.findByReporterId(userId).stream()
                .flatMap(report -> sightingRepository.findByReportIdOrderByCreatedAtDesc(report.getReportId()).stream())
                .filter(sighting -> "NEW".equals(sighting.getStatus()))
                .count();
        long openCases = caseRepository.findByOwnerIdOrParticipantIdOrderByUpdatedAtDesc(userId, userId).stream()
                .filter(item -> !"ADOPTED".equals(item.getStatus()))
                .filter(item -> !"CANCELLED".equals(item.getStatus()))
                .filter(item -> !"RESOLVED".equals(item.getStatus()))
                .filter(item -> !"CLOSED".equals(item.getStatus()))
                .count();
        return new NotificationSummaryDTO(adoptionRequests, sightings, openCases, adoptionRequests + sightings + openCases);
    }

    private CaseDTO createAdoptionCaseInternal(Integer requestId) {
        AdoptionRequestEntity request = adoptionRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Solicitud de adopcion no encontrada"));
        PetsEntity pet = petsRepository.findById(request.getPetId())
                .orElseThrow(() -> new RuntimeException("Mascota no encontrada"));

        CaseEntity caseEntity = new CaseEntity();
        caseEntity.setCaseType("ADOPTION");
        caseEntity.setStatus("OPEN");
        caseEntity.setPetId(pet.getPetId());
        caseEntity.setAdoptionRequestId(request.getRequestId());
        caseEntity.setOwnerId(pet.getOwnerId());
        caseEntity.setParticipantId(request.getUserId());
        caseEntity.setTitle("Adopcion de " + pet.getName());
        caseEntity.setLastMessage(request.getMessage());
        caseEntity = caseRepository.save(caseEntity);

        request.setStatus(AdoptionRequestStatus.APPROVED);
        request.setDecisionNotes("CONTACT_CASE_OPENED");
        request.setUpdatedAt(LocalDateTime.now());
        adoptionRequestRepository.save(request);

        addSystemMessage(caseEntity.getCaseId(), request.getUserId(), request.getContactName(), request.getMessage());
        return toDto(caseEntity, true);
    }

    private CaseDTO createSightingCaseInternal(Integer sightingId) {
        ReportSightingEntity sighting = sightingRepository.findById(sightingId)
                .orElseThrow(() -> new RuntimeException("Aviso no encontrado"));
        LostPetReportEntity report = reportRepository.findById(sighting.getReportId())
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado"));

        CaseEntity caseEntity = new CaseEntity();
        caseEntity.setCaseType("LOST");
        caseEntity.setStatus("OPEN");
        caseEntity.setReportId(report.getReportId());
        caseEntity.setReportSightingId(sighting.getSightingId());
        caseEntity.setOwnerId(report.getReporterId());
        caseEntity.setParticipantId(sighting.getUserId());
        caseEntity.setTitle("Aviso sobre " + report.getName());
        caseEntity.setLastMessage(sighting.getMessage());
        caseEntity = caseRepository.save(caseEntity);

        sighting.setStatus("CASE_OPENED");
        sighting.setCaseOpenedAt(LocalDateTime.now());
        sightingRepository.save(sighting);

        addSystemMessage(caseEntity.getCaseId(), sighting.getUserId(), sighting.getContactName(), sighting.getMessage());
        return toDto(caseEntity, true);
    }

    private void addSystemMessage(Integer caseId, Integer senderId, String senderName, String messageText) {
        if (messageText == null || messageText.isBlank()) {
            return;
        }
        CaseMessageEntity message = new CaseMessageEntity();
        message.setCaseId(caseId);
        message.setSenderId(senderId);
        message.setSenderName(senderName == null || senderName.isBlank() ? resolveUserName(senderId) : senderName);
        message.setMessage(messageText.trim());
        messageRepository.save(message);
    }

    private CaseDTO toDto(CaseEntity caseEntity, boolean includeMessages) {
        PetsEntity pet = caseEntity.getPetId() == null ? null : petsRepository.findById(caseEntity.getPetId()).orElse(null);
        LostPetReportEntity report = caseEntity.getReportId() == null ? null : reportRepository.findById(caseEntity.getReportId()).orElse(null);
        AdoptionRequestEntity adoptionRequest = caseEntity.getAdoptionRequestId() == null ? null : adoptionRequestRepository.findById(caseEntity.getAdoptionRequestId()).orElse(null);
        ReportSightingEntity sighting = caseEntity.getReportSightingId() == null ? null : sightingRepository.findById(caseEntity.getReportSightingId()).orElse(null);
        UserEntity owner = userRepository.findById(caseEntity.getOwnerId()).orElse(null);
        UserEntity participant = caseEntity.getParticipantId() == null ? null : userRepository.findById(caseEntity.getParticipantId()).orElse(null);

        String imageUrl = null;
        if (pet != null && pet.getImages() != null && !pet.getImages().isEmpty()) {
            imageUrl = pet.getImages().stream()
                    .min(Comparator.comparing(image -> !Boolean.TRUE.equals(image.getIsPrimary())))
                    .map(ImageEntity::getUrlImage)
                    .orElse(null);
        }
        if (imageUrl == null && report != null) {
            imageUrl = report.getImageUrl();
        }

        String participantName = participant != null ? participant.getUsername() : null;
        String participantEmail = participant != null ? participant.getEmail() : null;
        String participantPhone = participant != null ? participant.getPhone() : null;
        if (adoptionRequest != null) {
            participantName = adoptionRequest.getContactName();
            participantEmail = adoptionRequest.getContactEmail();
            participantPhone = adoptionRequest.getContactPhone();
        }
        if (sighting != null) {
            participantName = sighting.getContactName();
            participantEmail = sighting.getContactEmail();
            participantPhone = sighting.getContactPhone();
        }

        List<CaseMessageDTO> messages = includeMessages
                ? messageRepository.findByCaseIdOrderByCreatedAtAsc(caseEntity.getCaseId()).stream().map(this::toMessageDto).toList()
                : List.of();

        return new CaseDTO(
                caseEntity.getCaseId(),
                caseEntity.getCaseType(),
                caseEntity.getStatus(),
                caseEntity.getPetId(),
                caseEntity.getReportId(),
                caseEntity.getAdoptionRequestId(),
                caseEntity.getReportSightingId(),
                caseEntity.getOwnerId(),
                owner != null ? owner.getUsername() : null,
                owner != null ? owner.getEmail() : null,
                caseEntity.getParticipantId(),
                participantName,
                participantEmail,
                participantPhone,
                caseEntity.getTitle(),
                pet != null ? pet.getName() : report != null ? report.getName() : null,
                imageUrl,
                pet != null ? pet.getLocation() : report != null ? report.getLocation() : null,
                pet != null ? pet.getDescription() : report != null ? report.getDescription() : null,
                caseEntity.getLastMessage(),
                caseEntity.getCreatedAt(),
                caseEntity.getUpdatedAt(),
                messages
        );
    }

    private CaseMessageDTO toMessageDto(CaseMessageEntity message) {
        return new CaseMessageDTO(
                message.getMessageId(),
                message.getCaseId(),
                message.getSenderId(),
                message.getSenderName(),
                message.getMessage(),
                splitImageUrls(message.getImageUrls()),
                message.getCreatedAt()
        );
    }

    private String joinImageUrls(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return null;
        }
        return String.join("\n", imageUrls);
    }

    private List<String> splitImageUrls(String imageUrls) {
        if (imageUrls == null || imageUrls.isBlank()) {
            return List.of();
        }
        return Arrays.stream(imageUrls.split("\\R"))
                .filter(value -> value != null && !value.isBlank())
                .toList();
    }

    private String resolveUserName(Integer userId) {
        if (userId == null) {
            return "Contacto externo";
        }
        return userRepository.findById(userId).map(UserEntity::getUsername).orElse("Usuario");
    }
}
