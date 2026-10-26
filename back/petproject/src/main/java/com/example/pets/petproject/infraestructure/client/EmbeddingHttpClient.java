package com.example.pets.petproject.infraestructure.client;

import com.example.pets.petproject.domain.service.DogDescription;
import com.example.pets.petproject.domain.service.EmbeddingClient;
import com.example.pets.petproject.domain.service.ImageAnalysis;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Adaptador HTTP hacia el ml-service (FastAPI + EfficientNetB0).
 * Llama a POST /embeddings con la imagen como multipart y devuelve el vector.
 *
 * Se usa RestTemplate (no RestClient) para el multipart: el proyecto es servlet
 * puro y RestClient hace una comprobacion interna contra org.reactivestreams.Publisher
 * que no esta en el classpath.
 */
@Component
@Slf4j
public class EmbeddingHttpClient implements EmbeddingClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public EmbeddingHttpClient(
            @Value("${mlservice.base-url:http://localhost:8000}") String baseUrl,
            @Value("${mlservice.timeout-ms:15000}") int timeoutMs
    ) {
        this.baseUrl = baseUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        factory.setReadTimeout(Duration.ofMillis(timeoutMs));
        this.restTemplate = new RestTemplate(factory);
        log.info("EmbeddingHttpClient apuntando a {}", baseUrl);
    }

    @Override
    public Optional<float[]> embed(byte[] imageBytes, String filename, String contentType) {
        if (imageBytes == null || imageBytes.length == 0) {
            return Optional.empty();
        }
        try {
            HttpEntity<MultiValueMap<String, Object>> request = buildMultipart(imageBytes, filename, contentType);
            EmbeddingResponse response = restTemplate.postForObject(
                    baseUrl + "/embeddings", request, EmbeddingResponse.class);

            if (response == null || response.embeddings() == null || response.embeddings().isEmpty()) {
                return Optional.empty();
            }
            float[] vector = toFloatArray(response.embeddings().get(0).embedding());
            return vector.length == 0 ? Optional.empty() : Optional.of(vector);
        } catch (Exception e) {
            log.warn("ml-service no genero embedding ({}): {}", filename, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public Optional<ImageAnalysis> analyze(byte[] imageBytes, String filename, String contentType) {
        if (imageBytes == null || imageBytes.length == 0) {
            return Optional.empty();
        }
        try {
            HttpEntity<MultiValueMap<String, Object>> request = buildMultipart(imageBytes, filename, contentType);
            AnalyzeResponse response = restTemplate.postForObject(
                    baseUrl + "/analyze", request, AnalyzeResponse.class);

            if (response == null || response.items() == null || response.items().isEmpty()) {
                return Optional.empty();
            }
            AnalyzeItem item = response.items().get(0);
            float[] vector = toFloatArray(item.embedding());
            if (vector.length == 0) {
                return Optional.empty();
            }
            return Optional.of(new ImageAnalysis(vector, item.breed(), item.breedConfidence(), item.animal()));
        } catch (Exception e) {
            log.warn("ml-service no analizo imagen ({}): {}", filename, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public Optional<DogDescription> describe(byte[] imageBytes, String filename, String contentType) {
        if (imageBytes == null || imageBytes.length == 0) {
            return Optional.empty();
        }
        try {
            HttpEntity<MultiValueMap<String, Object>> request = buildMultipart(imageBytes, filename, contentType);
            DescribeResponse response = restTemplate.postForObject(
                    baseUrl + "/describe", request, DescribeResponse.class);
            if (response == null || response.items() == null || response.items().isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(response.items().get(0).toDomain());
        } catch (Exception e) {
            log.warn("ml-service no describio la imagen ({}): {}", filename, e.getMessage());
            return Optional.empty();
        }
    }

    private HttpEntity<MultiValueMap<String, Object>> buildMultipart(byte[] imageBytes, String filename, String contentType) {
        ByteArrayResource resource = new ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return filename != null ? filename : "imagen.jpg";
            }
        };
        HttpHeaders partHeaders = new HttpHeaders();
        partHeaders.setContentType(MediaType.parseMediaType(
                contentType != null ? contentType : MediaType.IMAGE_JPEG_VALUE));
        HttpEntity<ByteArrayResource> filePart = new HttpEntity<>(resource, partHeaders);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("files", filePart);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return new HttpEntity<>(body, headers);
    }

    private float[] toFloatArray(List<Float> values) {
        if (values == null || values.isEmpty()) {
            return new float[0];
        }
        float[] vector = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = values.get(i);
        }
        return vector;
    }

    @Override
    public boolean isAvailable() {
        try {
            restTemplate.getForEntity(baseUrl + "/health", String.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // --- Contratos de respuesta del ml-service ---

    private record EmbeddingResponse(String model, Integer dim, Boolean normalized,
                                     Integer count, List<EmbeddingItem> embeddings) {
    }

    private record EmbeddingItem(String filename, Integer dim, List<Float> embedding) {
    }

    private record AnalyzeResponse(@JsonProperty("embedding_model") String embeddingModel,
                                   @JsonProperty("breed_model") String breedModel,
                                   Integer dim, Boolean normalized, Integer count,
                                   List<AnalyzeItem> items) {
    }

    private record AnalyzeItem(String filename, List<Float> embedding, String breed,
                               @JsonProperty("breed_confidence") Float breedConfidence,
                               String animal, @JsonProperty("is_dog") Boolean isDog) {
    }

    private record DescribeResponse(String model, Integer count, List<DescribeItem> items) {
    }

    private record WeightRange(Float min, Float max) {
    }

    private record DescribeItem(String filename,
                                @JsonProperty("is_dog") Boolean isDog,
                                String animal,
                                @JsonProperty("not_dog_type") String notDogType,
                                @JsonProperty("dog_probability") Float dogProbability,
                                String message,
                                String breed,
                                @JsonProperty("breed_confidence") Float breedConfidence,
                                @JsonProperty("in_catalog") Boolean inCatalog,
                                @JsonProperty("breed_top") List<DogDescription.BreedScore> breedTop,
                                String size,
                                @JsonProperty("size_confidence") Float sizeConfidence,
                                @JsonProperty("weight_kg") WeightRange weightKg,
                                String age,
                                @JsonProperty("age_confidence") Float ageConfidence,
                                @JsonProperty("puppy_probability") Float puppyProbability,
                                String color,
                                @JsonProperty("color_secondary") String colorSecondary,
                                @JsonProperty("color_label") String colorLabel) {

        DogDescription toDomain() {
            return new DogDescription(
                    isDog == null || isDog, animal, notDogType, dogProbability, message,
                    breed, breedConfidence, inCatalog != null && inCatalog,
                    breedTop != null ? breedTop : List.of(),
                    size, sizeConfidence,
                    weightKg != null ? weightKg.min() : null, weightKg != null ? weightKg.max() : null,
                    age, ageConfidence, puppyProbability,
                    color, colorSecondary, colorLabel);
        }
    }
}
