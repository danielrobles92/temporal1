package com.example.pets.petproject.domain.core;

import com.example.pets.petproject.domain.port.LostPetReportRepositoryDB;
import com.example.pets.petproject.domain.port.PetImageEmbeddingRepositoryDB;
import com.example.pets.petproject.domain.port.PetsRepositoryDB;
import com.example.pets.petproject.domain.port.ReportImageEmbeddingRepositoryDB;
import com.example.pets.petproject.domain.service.EmbeddingClient;
import com.example.pets.petproject.domain.service.ImageAnalysis;
import com.example.pets.petproject.domain.service.ImageStorageService;
import com.example.pets.petproject.infraestructure.entity.ImageEntity;
import com.example.pets.petproject.infraestructure.entity.LostPetReportEntity;
import com.example.pets.petproject.infraestructure.entity.PetImageEmbeddingEntity;
import com.example.pets.petproject.infraestructure.entity.PetsEntity;
import com.example.pets.petproject.infraestructure.entity.ReportImageEmbeddingEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Orquesta el analisis (embedding individual + raza) y su persistencia para las
 * imagenes de mascotas, y el analisis del lado reporte para el matching. El calculo
 * pesado vive en el ml-service; aqui solo se coordina lectura, llamada y guardado.
 *
 * Degrada de forma segura: si el ml-service no responde, no se interrumpe el flujo
 * principal (publicar/editar mascota).
 */
@Service
@Slf4j
public class ImageEmbeddingService {

    private static final String MODEL = "efficientnet_b0";

    private final EmbeddingClient embeddingClient;
    private final PetImageEmbeddingRepositoryDB embeddingRepository;
    private final ReportImageEmbeddingRepositoryDB reportEmbeddingRepository;
    private final ImageStorageService imageStorageService;
    private final PetsRepositoryDB petsRepository;
    private final LostPetReportRepositoryDB reportRepository;

    public ImageEmbeddingService(
            EmbeddingClient embeddingClient,
            PetImageEmbeddingRepositoryDB embeddingRepository,
            ReportImageEmbeddingRepositoryDB reportEmbeddingRepository,
            ImageStorageService imageStorageService,
            PetsRepositoryDB petsRepository,
            LostPetReportRepositoryDB reportRepository
    ) {
        this.embeddingClient = embeddingClient;
        this.embeddingRepository = embeddingRepository;
        this.reportEmbeddingRepository = reportEmbeddingRepository;
        this.imageStorageService = imageStorageService;
        this.petsRepository = petsRepository;
        this.reportRepository = reportRepository;
    }

    /** Analiza y guarda (embedding + raza) cada imagen de la mascota que falte. */
    @Transactional
    public void embedPetImages(PetsEntity pet) {
        if (pet == null || pet.getImages() == null) {
            return;
        }
        for (ImageEntity image : pet.getImages()) {
            processImage(image, false);
        }
    }

    /** Procesa imagenes sin embedding o sin raza. Devuelve cuantas guardo/actualizo. */
    @Transactional
    public int backfillMissing() {
        return backfillMissing(false);
    }

    /**
     * Como backfillMissing; con force=true vuelve a analizar TODAS las imagenes
     * (p. ej. tras cambiar el modelo de raza: 20 razas + "Otro" + no-perro).
     */
    @Transactional
    public int backfillMissing(boolean force) {
        int processed = 0;
        for (PetsEntity pet : petsRepository.findAll()) {
            if (pet.getImages() == null) {
                continue;
            }
            for (ImageEntity image : pet.getImages()) {
                if (processImage(image, force)) {
                    processed++;
                }
            }
        }
        return processed;
    }

    /** Analiza (sin persistir) la imagen de un reporte: embedding individual + raza. */
    public Optional<ImageAnalysis> analyzeReportImage(String imageUrl) {
        byte[] bytes = imageStorageService.readStoredImage(imageUrl);
        if (bytes == null) {
            return Optional.empty();
        }
        String filename = filenameFor(imageUrl);
        return embeddingClient.analyze(bytes, filename, contentTypeFor(filename));
    }

    /** Guarda el embedding + raza de la imagen de un reporte (si aun no lo tiene). */
    @Transactional
    public boolean embedReport(Integer reportId, String imageUrl) {
        return embedReport(reportId, imageUrl, false);
    }

    /** force=true: vuelve a analizar aunque ya tenga embedding (actualiza raza). */
    @Transactional
    public boolean embedReport(Integer reportId, String imageUrl, boolean force) {
        if (reportId == null) {
            return false;
        }
        ReportImageEmbeddingEntity existing = reportEmbeddingRepository.findByReportIdIn(List.of(reportId))
                .stream().findFirst().orElse(null);
        if (existing != null && !force) {
            return false;
        }
        Optional<ImageAnalysis> analysis = analyzeReportImage(imageUrl);
        if (analysis.isEmpty()) {
            return false;
        }
        ImageAnalysis a = analysis.get();
        if (!a.isDog()) {
            log.warn("Reporte {}: la imagen no parece un perro (animal={}); no se asigna raza",
                    reportId, a.animal());
        }
        ReportImageEmbeddingEntity entity = existing != null ? existing : new ReportImageEmbeddingEntity();
        entity.setReportId(reportId);
        entity.setEmbedding(a.embedding());
        entity.setDim(a.embedding().length);
        entity.setModel(MODEL);
        entity.setBreed(a.isDog() ? a.breed() : null);
        entity.setBreedConfidence(a.isDog() ? a.breedConfidence() : null);
        entity.setCreatedAt(LocalDateTime.now());
        reportEmbeddingRepository.save(entity);
        return true;
    }

    /** Como embedReport, pero no interrumpe el flujo principal si falla. */
    public void embedReportSafely(Integer reportId, String imageUrl) {
        try {
            embedReport(reportId, imageUrl);
        } catch (Exception e) {
            log.warn("No se pudo generar embedding del reporte {}: {}", reportId, e.getMessage());
        }
    }

    /** Procesa los reportes con imagen que aun no tienen embedding. */
    @Transactional
    public int backfillReports() {
        return backfillReports(false);
    }

    @Transactional
    public int backfillReports(boolean force) {
        int processed = 0;
        for (LostPetReportEntity report : reportRepository.findAll()) {
            if (report.getImageUrl() == null || report.getImageUrl().isBlank()) {
                continue;
            }
            if (embedReport(report.getReportId(), report.getImageUrl(), force)) {
                processed++;
            }
        }
        return processed;
    }

    /** Inserta o completa el embedding+raza de una imagen. true si hizo trabajo. */
    private boolean processImage(ImageEntity image, boolean force) {
        if (image == null || image.getImageId() == null) {
            return false;
        }
        PetImageEmbeddingEntity existing = embeddingRepository
                .findByImage_ImageId(image.getImageId())
                .orElse(null);
        if (existing != null && existing.getBreed() != null && !force) {
            return false; // ya tiene embedding y raza
        }

        byte[] bytes = imageStorageService.readStoredImage(image.getUrlImage());
        if (bytes == null) {
            return false;
        }
        String filename = filenameFor(image.getUrlImage());
        Optional<ImageAnalysis> analysis = embeddingClient.analyze(bytes, filename, contentTypeFor(filename));
        if (analysis.isEmpty()) {
            return false;
        }

        ImageAnalysis a = analysis.get();
        if (!a.isDog()) {
            log.warn("Imagen {} no parece un perro (animal={}); no se asigna raza", filename, a.animal());
        }
        PetImageEmbeddingEntity entity = existing != null ? existing : new PetImageEmbeddingEntity();
        if (existing == null) {
            entity.setImage(image);
            entity.setCreatedAt(LocalDateTime.now());
        }
        entity.setEmbedding(a.embedding());
        entity.setDim(a.embedding().length);
        entity.setModel(MODEL);
        // Si no es un perro (lobo/otro), no se asigna raza: nunca pasara el filtro de raza.
        entity.setBreed(a.isDog() ? a.breed() : null);
        entity.setBreedConfidence(a.isDog() ? a.breedConfidence() : null);
        embeddingRepository.save(entity);
        return true;
    }

    private String filenameFor(String url) {
        if (url == null || url.isBlank()) {
            return "imagen.jpg";
        }
        int slash = url.lastIndexOf('/');
        return slash >= 0 ? url.substring(slash + 1) : url;
    }

    private String contentTypeFor(String filename) {
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/jpeg";
    }

    // Calibracion P(mismo perro) = sigmoid(W*cos + B), ajustada sobre el dataset MX
    // (ml-service/experiments/calibrate.py): positivos mismo-perro vs negativos
    // misma-raza. Frontera 50% en cos=0.75; "muy probable" (>=70%) en cos>=0.77.
    private static final double CALIB_W = 30.9448;
    private static final double CALIB_B = -23.0951;

    /** Probabilidad calibrada [0,1] de que dos fotos sean del mismo perro, dado el coseno. */
    public static double sameDogProbability(double cosine) {
        double z = CALIB_W * cosine + CALIB_B;
        return 1.0 / (1.0 + Math.exp(-z));
    }

    /**
     * Similitud del coseno entre dos vectores. Los embeddings vienen normalizados
     * (norma L2 = 1) desde el ml-service, asi que equivale al producto punto.
     */
    public static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0.0;
        }
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
