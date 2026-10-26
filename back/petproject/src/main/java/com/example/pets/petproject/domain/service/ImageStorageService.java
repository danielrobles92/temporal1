package com.example.pets.petproject.domain.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class ImageStorageService {

    private static final List<String> ALLOWED_TYPES = List.of("image/jpeg", "image/png", "image/webp");

    private final Path petUploadPath;

    public ImageStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.petUploadPath = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("pets");
    }

    public String storePetImage(MultipartFile file) {
        return storeImage(file, "pets");
    }

    public String storeReportImage(MultipartFile file) {
        return storeImage(file, "reports");
    }

    public String storeSightingImage(MultipartFile file) {
        return storeImage(file, "sightings");
    }

    public String storeCaseMessageImage(MultipartFile file) {
        return storeImage(file, "case-messages");
    }

    private String storeImage(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Solo se permiten imagenes JPG, PNG o WEBP");
        }

        try {
            Path targetDirectory = petUploadPath.getParent().resolve(folder);
            Files.createDirectories(targetDirectory);
            String extension = extensionFor(contentType);
            String fileName = UUID.randomUUID() + extension;
            Path target = targetDirectory.resolve(fileName).normalize();
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + folder + "/" + fileName;
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar la imagen", e);
        }
    }

    private String extensionFor(String contentType) {
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }

    /**
     * Lee de disco una imagen previamente almacenada a partir de su URL publica
     * (p. ej. "/uploads/pets/xxx.jpg"). Devuelve null si la URL no apunta a un
     * archivo local (Data URL, externa) o si no existe. Protege contra path traversal.
     */
    public byte[] readStoredImage(String storedUrl) {
        if (storedUrl == null || storedUrl.isBlank() || storedUrl.startsWith("data:")
                || storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
            return null;
        }

        String relative = storedUrl;
        int idx = storedUrl.indexOf("/uploads/");
        if (idx >= 0) {
            relative = storedUrl.substring(idx + "/uploads/".length());
        } else if (storedUrl.startsWith("/")) {
            relative = storedUrl.substring(1);
        }

        Path base = petUploadPath.getParent();
        Path file = base.resolve(relative).normalize();
        if (!file.startsWith(base)) {
            return null; // intento de salir del directorio de uploads
        }

        try {
            return Files.exists(file) ? Files.readAllBytes(file) : null;
        } catch (IOException e) {
            return null;
        }
    }
}
