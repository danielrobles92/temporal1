package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.core.DogImageGuard;
import com.example.pets.petproject.domain.core.ImageEmbeddingService;
import com.example.pets.petproject.domain.core.NotificationService;
import com.example.pets.petproject.domain.enums.MatchStatus;
import com.example.pets.petproject.domain.enums.PetSex;
import com.example.pets.petproject.domain.enums.PetStatus;
import com.example.pets.petproject.domain.enums.ReportStatus;
import com.example.pets.petproject.domain.enums.ReportType;
import com.example.pets.petproject.domain.model.LostPetReportDTO;
import com.example.pets.petproject.domain.model.MatchStatusUpdateDTO;
import com.example.pets.petproject.domain.model.ModerationDTO;
import com.example.pets.petproject.domain.model.PotentialMatchDTO;
import com.example.pets.petproject.domain.model.CreateReportSightingDTO;
import com.example.pets.petproject.domain.model.ReportSightingDTO;
import com.example.pets.petproject.domain.model.ReplyReportSightingDTO;
import com.example.pets.petproject.domain.port.LostPetReportRepositoryDB;
import com.example.pets.petproject.domain.port.MatchRepositoryDB;
import com.example.pets.petproject.domain.port.PetImageEmbeddingRepositoryDB;
import com.example.pets.petproject.domain.port.PetsRepositoryDB;
import com.example.pets.petproject.domain.port.ReportImageEmbeddingRepositoryDB;
import com.example.pets.petproject.domain.port.ReportSightingRepositoryDB;
import com.example.pets.petproject.domain.port.UserRepositoryDB;
import com.example.pets.petproject.domain.service.DogDescription;
import com.example.pets.petproject.domain.service.ImageAnalysis;
import com.example.pets.petproject.domain.service.ImageStorageService;
import com.example.pets.petproject.infraestructure.entity.LostPetReportEntity;
import com.example.pets.petproject.infraestructure.entity.MatchEntity;
import com.example.pets.petproject.infraestructure.entity.PetImageEmbeddingEntity;
import com.example.pets.petproject.infraestructure.entity.PetsEntity;
import com.example.pets.petproject.infraestructure.entity.ReportImageEmbeddingEntity;
import com.example.pets.petproject.infraestructure.entity.ReportSightingEntity;
import com.example.pets.petproject.security.AuthUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/reports")
@CrossOrigin
public class ReportsController {

    private final LostPetReportRepositoryDB repository;
    private final ReportSightingRepositoryDB sightingRepository;
    private final PetsRepositoryDB petsRepository;
    private final UserRepositoryDB userRepository;
    private final ImageStorageService imageStorageService;
    private final ImageEmbeddingService imageEmbeddingService;
    private final PetImageEmbeddingRepositoryDB petImageEmbeddingRepository;
    private final ReportImageEmbeddingRepositoryDB reportImageEmbeddingRepository;
    private final MatchRepositoryDB matchRepository;
    private final NotificationService notificationService;
    private final DogImageGuard dogImageGuard;

    public ReportsController(
            LostPetReportRepositoryDB repository,
            ReportSightingRepositoryDB sightingRepository,
            PetsRepositoryDB petsRepository,
            UserRepositoryDB userRepository,
            ImageStorageService imageStorageService,
            ImageEmbeddingService imageEmbeddingService,
            PetImageEmbeddingRepositoryDB petImageEmbeddingRepository,
            ReportImageEmbeddingRepositoryDB reportImageEmbeddingRepository,
            MatchRepositoryDB matchRepository,
            NotificationService notificationService,
            DogImageGuard dogImageGuard
    ) {
        this.repository = repository;
        this.sightingRepository = sightingRepository;
        this.petsRepository = petsRepository;
        this.userRepository = userRepository;
        this.imageStorageService = imageStorageService;
        this.imageEmbeddingService = imageEmbeddingService;
        this.petImageEmbeddingRepository = petImageEmbeddingRepository;
        this.reportImageEmbeddingRepository = reportImageEmbeddingRepository;
        this.matchRepository = matchRepository;
        this.notificationService = notificationService;
        this.dogImageGuard = dogImageGuard;
    }

    @GetMapping
    public List<LostPetReportDTO> getAll(@RequestParam(required = false) ReportType type) {
        List<LostPetReportEntity> reports = type == null ? repository.findAll() : repository.findByType(type);
        return reports.stream().map(this::toDto).toList();
    }

    @GetMapping("/user/{userId}")
    public List<LostPetReportDTO> getByUser(@PathVariable Integer userId) {
        return repository.findByReporterId(userId).stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public LostPetReportDTO getById(@PathVariable Integer id) {
        return repository.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado"));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public LostPetReportDTO create(@RequestBody LostPetReportDTO dto) {
        return saveReport(dto, dto.imageUrl());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LostPetReportDTO createWithImage(
            @RequestPart("report") LostPetReportDTO dto,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) {
        dogImageGuard.requireDog(image); // gato/peluche/otro animal/objeto -> 422
        String imagePath = imageStorageService.storeReportImage(image);
        return saveReport(dto, imagePath);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public LostPetReportDTO update(@PathVariable Integer id, @RequestBody LostPetReportDTO dto) {
        LostPetReportEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado"));
        requireOwnerOrAdmin(entity);
        applyReportData(entity, dto, dto.imageUrl());
        return toDto(repository.save(entity));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LostPetReportDTO updateWithImage(
            @PathVariable Integer id,
            @RequestPart("report") LostPetReportDTO dto,
            @RequestPart(value = "image", required = false) MultipartFile image
    ) {
        LostPetReportEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado"));
        requireOwnerOrAdmin(entity);
        dogImageGuard.requireDog(image);
        String imagePath = image != null && !image.isEmpty()
                ? imageStorageService.storeReportImage(image)
                : entity.getImageUrl();
        applyReportData(entity, dto, imagePath);
        return toDto(repository.save(entity));
    }

    private LostPetReportDTO saveReport(LostPetReportDTO dto, String imageUrl) {
        LostPetReportEntity entity = new LostPetReportEntity();
        // RN-02: el reportero es el usuario autenticado (no se confia en el cliente).
        Integer reporterId = AuthUtils.currentUserId() != null ? AuthUtils.currentUserId() : dto.reporterId();
        entity.setReporterId(reporterId);
        entity.setType(dto.type());
        entity.setName(dto.name());
        entity.setSpecies(dto.species());
        entity.setBreed(dto.breed());
        entity.setSex(dto.sex());
        entity.setColor(dto.color());
        entity.setAge(dto.age());
        entity.setLocation(dto.location());
        entity.setLatitude(dto.latitude());
        entity.setLongitude(dto.longitude());
        entity.setDescription(dto.description());
        entity.setContactPhone(dto.contactPhone());
        entity.setImageUrl(imageUrl);
        entity.setStatus(ReportStatus.OPEN);
        LostPetReportEntity saved = repository.save(entity);
        // Indexar la imagen del reporte para el matching reporte<->reporte.
        imageEmbeddingService.embedReportSafely(saved.getReportId(), saved.getImageUrl());
        return toDto(saved);
    }

    private void applyReportData(LostPetReportEntity entity, LostPetReportDTO dto, String imageUrl) {
        entity.setType(dto.type() != null ? dto.type() : entity.getType());
        entity.setName(dto.name());
        entity.setSpecies(dto.species());
        entity.setBreed(dto.breed());
        entity.setSex(dto.sex());
        entity.setColor(dto.color());
        entity.setAge(dto.age());
        entity.setLocation(dto.location());
        entity.setLatitude(dto.latitude());
        entity.setLongitude(dto.longitude());
        entity.setDescription(dto.description());
        entity.setContactPhone(dto.contactPhone());
        entity.setImageUrl(imageUrl);
        entity.setStatus(dto.status() != null ? dto.status() : entity.getStatus());
        entity.setUpdatedAt(LocalDateTime.now());
    }

    @PatchMapping("/{id}/moderation")
    public LostPetReportDTO moderate(@PathVariable Integer id, @RequestBody ModerationDTO dto) {
        // RN-12: la moderacion es exclusiva del administrador.
        if (!AuthUtils.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo un administrador puede moderar");
        }
        LostPetReportEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado"));
        entity.setStatus(ReportStatus.valueOf(dto.status()));
        entity.setModerationNotes(dto.notes());
        entity.setUpdatedAt(LocalDateTime.now());
        return toDto(repository.save(entity));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Integer id) {
        LostPetReportEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado"));
        requireOwnerOrAdmin(entity);
        repository.deleteById(id);
    }

    /** RN-09/RN-13: solo el responsable del reporte o un admin puede modificarlo/cerrarlo. */
    private void requireOwnerOrAdmin(LostPetReportEntity report) {
        if (!AuthUtils.isSelfOrAdmin(report.getReporterId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }
    }

    private static final int MATCH_THRESHOLD = 20;

    /**
     * Calcula las coincidencias potenciales de un reporte combinando el puntaje
     * visual (similitud del coseno entre embeddings de imagen) con el puntaje por
     * atributos (raza/sexo/color) y geolocalizacion. Persiste/actualiza las
     * coincidencias en la tabla matches (preservando las decisiones del usuario).
     */
    @Transactional
    @GetMapping("/{id}/matches")
    public List<PotentialMatchDTO> getMatches(@PathVariable Integer id) {
        LostPetReportEntity report = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Reporte no encontrado"));

        ImageAnalysis reportAnalysis = imageEmbeddingService.analyzeReportImage(report.getImageUrl()).orElse(null);
        float[] reportVector = reportAnalysis != null ? reportAnalysis.embedding() : null;
        String reportBreed = reportAnalysis != null ? reportAnalysis.breed() : null;

        // Candidatos: mascotas del catalogo + reportes del tipo opuesto (perdido<->encontrado).
        List<Candidate> candidates = new ArrayList<>();
        candidates.addAll(buildPetCandidates());
        candidates.addAll(buildReportCandidates(report));

        List<PotentialMatchDTO> results = new ArrayList<>();
        for (Candidate candidate : candidates) {
            Scored scored = score(report, candidate, reportVector, reportBreed);
            if (scored.total < MATCH_THRESHOLD) {
                continue;
            }
            MatchEntity match = upsertMatch(report, candidate, scored);
            results.add(toMatchDto(match, candidate));
        }

        results.sort(Comparator.comparing(PotentialMatchDTO::score).reversed());
        return results.stream().limit(10).toList();
    }

    /** Genera los embeddings faltantes de las imagenes de reportes ya existentes. */
    @PostMapping("/embeddings/backfill")
    public Map<String, Integer> backfillReportEmbeddings(@RequestParam(defaultValue = "false") boolean force) {
        if (force && !AuthUtils.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo un administrador puede re-analizar todo");
        }
        return Map.of("processed", imageEmbeddingService.backfillReports(force));
    }

    /** Validar / rechazar / descartar una coincidencia (RF-34). */
    @PatchMapping("/matches/{matchId}/status")
    public PotentialMatchDTO updateMatchStatus(
            @PathVariable Integer matchId,
            @RequestBody MatchStatusUpdateDTO dto
    ) {
        MatchEntity match = matchRepository.findById(matchId)
                .orElseThrow(() -> new RuntimeException("Coincidencia no encontrada"));
        if (dto.status() == null || dto.status().isBlank()) {
            throw new IllegalArgumentException("El estado es requerido");
        }
        MatchStatus status;
        try {
            status = MatchStatus.valueOf(dto.status().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado invalido: " + dto.status());
        }
        match.setStatus(status);
        match.setUpdatedAt(LocalDateTime.now());
        MatchEntity saved = matchRepository.save(match);
        return toMatchDtoResolved(saved);
    }

    /** Candidato unificado: una mascota del catalogo o un reporte del tipo opuesto. */
    private record Candidate(Integer petId, Integer reportId, String name, String imageUrl,
                             Double latitude, Double longitude, String location,
                             PetSex sex, String color, List<float[]> embeddings, String mlBreed) {}

    private List<Candidate> buildPetCandidates() {
        List<PetsEntity> pets = petsRepository.findAll().stream()
                .filter(p -> p.getStatus() == PetStatus.LOST || p.getStatus() == PetStatus.AVAILABLE)
                .toList();
        Map<Integer, PetVisual> data = loadCandidateData(pets);
        List<Candidate> out = new ArrayList<>();
        for (PetsEntity p : pets) {
            PetVisual pv = data.get(p.getPetId());
            String imageUrl = p.getImages() != null && !p.getImages().isEmpty()
                    ? p.getImages().get(0).getUrlImage() : null;
            out.add(new Candidate(p.getPetId(), null, p.getName(), imageUrl,
                    p.getLatitude(), p.getLongitude(), p.getLocation(), p.getSex(), p.getColor(),
                    pv != null ? pv.embeddings() : List.of(), pv != null ? pv.breed() : null));
        }
        return out;
    }

    /** Reportes del tipo OPUESTO (un perdido busca encontrados y viceversa). */
    private List<Candidate> buildReportCandidates(LostPetReportEntity report) {
        ReportType opposite = report.getType() == ReportType.LOST ? ReportType.FOUND : ReportType.LOST;
        List<LostPetReportEntity> reports = repository.findByType(opposite).stream()
                .filter(r -> !r.getReportId().equals(report.getReportId()))
                .toList();
        if (reports.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = reports.stream().map(LostPetReportEntity::getReportId).toList();
        Map<Integer, ReportImageEmbeddingEntity> embByReport = new HashMap<>();
        for (ReportImageEmbeddingEntity e : reportImageEmbeddingRepository.findByReportIdIn(ids)) {
            embByReport.put(e.getReportId(), e);
        }
        List<Candidate> out = new ArrayList<>();
        for (LostPetReportEntity r : reports) {
            ReportImageEmbeddingEntity e = embByReport.get(r.getReportId());
            List<float[]> embs = e != null && e.getEmbedding() != null ? List.of(e.getEmbedding()) : List.of();
            out.add(new Candidate(null, r.getReportId(), r.getName(), r.getImageUrl(),
                    r.getLatitude(), r.getLongitude(), r.getLocation(), r.getSex(), r.getColor(),
                    embs, e != null ? e.getBreed() : null));
        }
        return out;
    }

    /** Datos visuales de un candidato: sus embeddings individuales + la raza predicha. */
    private record PetVisual(List<float[]> embeddings, String breed) {}

    private Map<Integer, PetVisual> loadCandidateData(List<PetsEntity> candidates) {
        if (candidates.isEmpty()) {
            return Map.of();
        }
        List<Integer> petIds = candidates.stream().map(PetsEntity::getPetId).toList();

        Map<Integer, List<float[]>> vectors = new HashMap<>();
        Map<Integer, String> breedByPet = new HashMap<>();
        Map<Integer, Float> bestConf = new HashMap<>();

        for (PetImageEmbeddingEntity e : petImageEmbeddingRepository.findByImage_Pet_PetIdIn(petIds)) {
            Integer petId = e.getImage().getPet().getPetId();
            if (e.getEmbedding() != null) {
                vectors.computeIfAbsent(petId, k -> new ArrayList<>()).add(e.getEmbedding());
            }
            if (e.getBreed() != null) {
                float conf = e.getBreedConfidence() != null ? e.getBreedConfidence() : 0f;
                if (conf >= bestConf.getOrDefault(petId, -1f)) {
                    bestConf.put(petId, conf);
                    breedByPet.put(petId, e.getBreed());
                }
            }
        }

        Map<Integer, PetVisual> out = new HashMap<>();
        for (Integer petId : petIds) {
            out.put(petId, new PetVisual(vectors.getOrDefault(petId, List.of()), breedByPet.get(petId)));
        }
        return out;
    }

    private MatchEntity upsertMatch(LostPetReportEntity report, Candidate c, Scored scored) {
        java.util.Optional<MatchEntity> existing = c.petId() != null
                ? matchRepository.findByReportIdAndPetId(report.getReportId(), c.petId())
                : matchRepository.findByReportIdAndMatchedReportId(report.getReportId(), c.reportId());
        MatchEntity match = existing.orElseGet(MatchEntity::new);
        boolean isNew = match.getMatchId() == null;
        if (isNew) {
            match.setReportId(report.getReportId());
            match.setPetId(c.petId());
            match.setMatchedReportId(c.reportId());
            match.setStatus(MatchStatus.SUGGESTED);
            match.setCreatedAt(LocalDateTime.now());
        }
        // Notificar al duenio del reporte solo la primera vez y con confianza alta.
        if (isNew && scored.confidence != null && scored.confidence >= 0.7f) {
            notificationService.notify(report.getReporterId(), "MATCH",
                    "Posible coincidencia para " + report.getName(),
                    String.format("%s con %.0f%% de probabilidad de ser el mismo perro",
                            c.name(), scored.confidence * 100),
                    "/reporte/" + report.getReportId());
        }
        match.setVisualScore(scored.visual);
        match.setAttributeScore(scored.attribute);
        match.setScore((float) scored.total);
        match.setConfidence(scored.confidence);
        match.setReason(scored.reason);
        match.setUpdatedAt(LocalDateTime.now());
        return matchRepository.save(match);
    }

    private PotentialMatchDTO toMatchDto(MatchEntity match, Candidate c) {
        return new PotentialMatchDTO(
                match.getMatchId(),
                match.getReportId(),
                c.petId(),
                c.name(),
                c.imageUrl(),
                Math.round(match.getScore()),
                match.getVisualScore(),
                match.getConfidence(),
                match.getReason(),
                match.getStatus().name(),
                c.mlBreed(),
                c.reportId()
        );
    }

    /** Reconstruye el DTO de un match desde la BD (para el cambio de estado). */
    private PotentialMatchDTO toMatchDtoResolved(MatchEntity m) {
        String name = null;
        String imageUrl = null;
        String breed = null;
        if (m.getPetId() != null) {
            PetsEntity pet = petsRepository.findById(m.getPetId()).orElse(null);
            if (pet != null) {
                name = pet.getName();
                imageUrl = pet.getImages() != null && !pet.getImages().isEmpty()
                        ? pet.getImages().get(0).getUrlImage() : null;
            }
            breed = petImageEmbeddingRepository.findByImage_Pet_PetIdIn(List.of(m.getPetId()))
                    .stream().map(PetImageEmbeddingEntity::getBreed).filter(Objects::nonNull).findFirst().orElse(null);
        } else if (m.getMatchedReportId() != null) {
            LostPetReportEntity r = repository.findById(m.getMatchedReportId()).orElse(null);
            if (r != null) {
                name = r.getName();
                imageUrl = r.getImageUrl();
            }
            breed = reportImageEmbeddingRepository.findByReportIdIn(List.of(m.getMatchedReportId()))
                    .stream().map(ReportImageEmbeddingEntity::getBreed).filter(Objects::nonNull).findFirst().orElse(null);
        }
        return new PotentialMatchDTO(m.getMatchId(), m.getReportId(), m.getPetId(), name, imageUrl,
                Math.round(m.getScore()), m.getVisualScore(), m.getConfidence(), m.getReason(),
                m.getStatus().name(), breed, m.getMatchedReportId());
    }

    /** Resultado intermedio del calculo de un match. */
    private record Scored(int total, int attribute, Float visual, Float confidence, String reason) {}

    private Scored score(LostPetReportEntity report, Candidate c, float[] reportVector, String reportBreed) {
        StringBuilder reason = new StringBuilder();
        String candBreed = c.mlBreed();

        // --- Filtro de raza (0..40): mismo perro => misma raza ---
        int breedPoints = 0;
        boolean breedMismatch = false;
        // "Otro" (otra raza / mestizo) no suma ni penaliza en el filtro de raza.
        if (DogDescription.isCatalogBreed(reportBreed) && DogDescription.isCatalogBreed(candBreed)) {
            if (reportBreed.equalsIgnoreCase(candBreed)) {
                breedPoints = 40;
                reason.append("raza ").append(candBreed).append(" ");
            } else {
                breedMismatch = true;
                reason.append("otra raza (").append(candBreed).append(") ");
            }
        }

        // --- Puntaje visual individual (0..40, a la mitad si la raza no coincide) ---
        Float visual = null;
        Float confidence = null;
        int visualPoints = 0;
        if (reportVector != null && c.embeddings() != null && !c.embeddings().isEmpty()) {
            double best = 0.0;
            for (float[] embedding : c.embeddings()) {
                best = Math.max(best, ImageEmbeddingService.cosine(reportVector, embedding));
            }
            double clamped = Math.max(0.0, Math.min(1.0, best));
            visual = (float) clamped;
            double weighted = breedMismatch ? clamped * 0.5 : clamped;
            visualPoints = (int) Math.round(weighted * 40);

            // Probabilidad calibrada de ser el mismo perro; otra raza la reduce fuerte.
            double p = ImageEmbeddingService.sameDogProbability(clamped);
            if (breedMismatch) {
                p *= 0.15;
            }
            confidence = (float) Math.max(0.0, Math.min(1.0, p));
            reason.append(String.format("imagen %.0f%% ", clamped * 100));
        }

        // --- Geolocalizacion (0..10) ---
        Double distanceKm = null;
        if (report.getLatitude() != null && report.getLongitude() != null
                && c.latitude() != null && c.longitude() != null) {
            distanceKm = distanceKm(report.getLatitude(), report.getLongitude(),
                    c.latitude(), c.longitude());
        }
        boolean sameLocationText = report.getLocation() != null && c.location() != null
                && normalize(report.getLocation()).equals(normalize(c.location()));
        int locationScore = 0;
        if (distanceKm != null && distanceKm <= 2.0) {
            locationScore = 10;
            reason.append("ubicacion ").append(Math.round(distanceKm * 1000)).append("m ");
        } else if (sameLocationText) {
            locationScore = 10;
            reason.append("misma ubicacion ");
        }

        // --- Atributos sexo/color (0..10) ---
        int attributeScore = 0;
        if (report.getSex() != null && report.getSex() == c.sex()) {
            attributeScore += 5;
            reason.append("sexo ");
        }
        if (report.getColor() != null && c.color() != null
                && c.color().toLowerCase().contains(report.getColor().toLowerCase())) {
            attributeScore += 5;
            reason.append("color ");
        }

        int attribute = breedPoints + locationScore + attributeScore; // parte no-visual
        int total = attribute + visualPoints; // 0..100
        return new Scored(total, attribute, visual, confidence, reason.toString().trim());
    }

    @PostMapping(value = "/{id}/sightings", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ReportSightingDTO createSighting(
            @PathVariable Integer id,
            @RequestPart("sighting") CreateReportSightingDTO dto,
            @RequestPart(value = "images", required = false) List<MultipartFile> images
    ) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Reporte no encontrado");
        }
        if (dto.contactName() == null || dto.contactName().isBlank()) {
            throw new IllegalArgumentException("El nombre de contacto es requerido");
        }
        if (dto.message() == null || dto.message().isBlank()) {
            throw new IllegalArgumentException("El mensaje es requerido");
        }

        List<String> imageUrls = images == null ? List.of() : images.stream()
                .limit(4)
                .map(imageStorageService::storeSightingImage)
                .filter(Objects::nonNull)
                .toList();

        ReportSightingEntity entity = new ReportSightingEntity();
        entity.setReportId(id);
        entity.setUserId(dto.userId());
        entity.setContactName(dto.contactName());
        entity.setContactEmail(dto.contactEmail());
        entity.setContactPhone(dto.contactPhone());
        entity.setLocation(dto.location());
        entity.setMessage(dto.message());
        entity.setImageUrls(String.join(",", imageUrls));
        ReportSightingDTO saved = toSightingDto(sightingRepository.save(entity));

        // Notificar al duenio del reporte que alguien vio a su perro.
        repository.findById(id).ifPresent(report ->
                notificationService.notify(report.getReporterId(), "SIGHTING",
                        "Nuevo aviso sobre " + report.getName(),
                        dto.contactName() + ": " + dto.message(),
                        "/mis-anuncios"));
        return saved;
    }

    @GetMapping("/{id}/sightings")
    public List<ReportSightingDTO> getSightings(@PathVariable Integer id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Reporte no encontrado");
        }
        return sightingRepository.findByReportIdOrderByCreatedAtDesc(id).stream()
                .map(this::toSightingDto)
                .toList();
    }

    @GetMapping("/sightings/owner/{ownerId}")
    public List<ReportSightingDTO> getSightingsByOwner(@PathVariable Integer ownerId) {
        return repository.findByReporterId(ownerId).stream()
                .flatMap(report -> sightingRepository.findByReportIdOrderByCreatedAtDesc(report.getReportId()).stream())
                .map(this::toSightingDto)
                .toList();
    }

    @GetMapping("/sightings")
    public List<ReportSightingDTO> getAllSightings() {
        return sightingRepository.findAll().stream()
                .map(this::toSightingDto)
                .toList();
    }

    @PatchMapping("/sightings/{sightingId}/reply")
    public ReportSightingDTO replySighting(
            @PathVariable Integer sightingId,
            @RequestBody ReplyReportSightingDTO dto
    ) {
        ReportSightingEntity entity = sightingRepository.findById(sightingId)
                .orElseThrow(() -> new RuntimeException("Aviso no encontrado"));
        if (dto.reply() == null || dto.reply().isBlank()) {
            throw new IllegalArgumentException("La respuesta es requerida");
        }
        entity.setOwnerReply(dto.reply());
        entity.setRepliedAt(LocalDateTime.now());
        entity.setStatus(dto.status() == null || dto.status().isBlank() ? "REPLIED" : dto.status());
        ReportSightingDTO saved = toSightingDto(sightingRepository.save(entity));

        // Notificar a quien dio el aviso que el duenio respondio.
        notificationService.notify(entity.getUserId(), "SIGHTING_REPLY",
                "Respondieron tu aviso", dto.reply(), "/casos");
        return saved;
    }

    @PatchMapping("/sightings/{sightingId}/case")
    public ReportSightingDTO updateSightingCase(
            @PathVariable Integer sightingId,
            @RequestBody ReplyReportSightingDTO dto
    ) {
        ReportSightingEntity entity = sightingRepository.findById(sightingId)
                .orElseThrow(() -> new RuntimeException("Aviso no encontrado"));
        String status = dto.status() == null || dto.status().isBlank() ? "CASE_OPENED" : dto.status();
        entity.setStatus(status);
        if ("CASE_OPENED".equals(status) && entity.getCaseOpenedAt() == null) {
            entity.setCaseOpenedAt(LocalDateTime.now());
        }
        if (dto.reply() != null && !dto.reply().isBlank()) {
            entity.setOwnerReply(dto.reply());
            entity.setRepliedAt(LocalDateTime.now());
        }
        return toSightingDto(sightingRepository.save(entity));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private ReportSightingDTO toSightingDto(ReportSightingEntity e) {
        List<String> imageUrls = e.getImageUrls() == null || e.getImageUrls().isBlank()
                ? List.of()
                : Arrays.stream(e.getImageUrls().split(","))
                .filter(value -> !value.isBlank())
                .toList();

        var report = repository.findById(e.getReportId()).orElse(null);
        var owner = report != null ? userRepository.findById(report.getReporterId()).orElse(null) : null;

        return new ReportSightingDTO(
                e.getSightingId(),
                e.getReportId(),
                e.getUserId(),
                e.getContactName(),
                e.getContactEmail(),
                e.getContactPhone(),
                e.getLocation(),
                e.getMessage(),
                imageUrls,
                e.getStatus(),
                e.getOwnerReply(),
                report != null ? report.getName() : null,
                report != null ? report.getReporterId() : null,
                owner != null ? owner.getUsername() : null,
                e.getCaseOpenedAt(),
                e.getRepliedAt(),
                e.getCreatedAt()
        );
    }

    private LostPetReportDTO toDto(LostPetReportEntity e) {
        var reporter = userRepository.findById(e.getReporterId()).orElse(null);
        return new LostPetReportDTO(
                e.getReportId(),
                e.getReporterId(),
                reporter != null ? reporter.getUsername() : null,
                reporter != null ? reporter.getEmail() : null,
                e.getType(),
                e.getName(),
                e.getSpecies(),
                e.getBreed(),
                e.getSex(),
                e.getColor(),
                e.getAge(),
                e.getLocation(),
                e.getLatitude(),
                e.getLongitude(),
                e.getDescription(),
                e.getContactPhone(),
                e.getImageUrl(),
                e.getStatus(),
                e.getModerationNotes(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
