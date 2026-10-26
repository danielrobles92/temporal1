package com.example.pets.petproject.domain.mapper;


import com.example.pets.petproject.domain.model.CreatedPetsDTO;
import com.example.pets.petproject.domain.model.PetsDTO;
import com.example.pets.petproject.domain.model.VaccineDTO;
import com.example.pets.petproject.infraestructure.entity.ImageEntity;
import com.example.pets.petproject.infraestructure.entity.PetsEntity;
import com.example.pets.petproject.infraestructure.entity.VaccineEntity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class PetsMapper {
    public static PetsDTO toDto(PetsEntity p) {
        return toDto(p, null);
    }

    public static PetsDTO toDto(PetsEntity p, String ownerName) {
        List<String> imageUrls = p.getImages() != null
                ? p.getImages().stream().map(ImageEntity::getUrlImage).toList()
                : List.of();

        List<VaccineDTO> vaccines = p.getVaccines() != null
                ? p.getVaccines().stream()
                    .map(v -> new VaccineDTO(v.getVaccineId(), v.getName(), v.getAppliedAt(),
                            v.getNextDoseAt(), v.getVet(), v.getLot()))
                    .toList()
                : List.of();

        return new PetsDTO(
                p.getPetId(),
                p.getOwnerId(),
                ownerName,
                p.getName(),
                p.getSpecies(),
                p.getBreed(),
                p.getSex(),
                p.getColor(),
                p.getAge(),
                p.getDescription(),
                p.getLocation(),
                p.getLatitude(),
                p.getLongitude(),
                p.getStatus(),
                imageUrls,
                p.getBirthDate(),
                p.getWeightKg(),
                p.getSterilized(),
                p.getMicrochip(),
                p.getDewormedAt(),
                p.getVetName(),
                p.getMedicalNotes(),
                vaccines
        );
    }

    public static PetsEntity toEntity(CreatedPetsDTO dto) {
        PetsEntity e = new PetsEntity();

        e.setOwnerId(dto.ownerId());
        e.setName(dto.name());
        e.setSpecies(dto.species());
        e.setBreed(dto.breed());
        e.setSex(dto.sex());
        e.setColor(dto.color());
        e.setAge(dto.age());
        e.setDescription(dto.description());
        e.setLocation(dto.location());
        e.setLatitude(dto.latitude());
        e.setLongitude(dto.longitude());
        e.setStatus(dto.status());
        e.setCreatedAt(LocalDateTime.now());

        // Cartilla / salud
        e.setBirthDate(dto.birthDate());
        e.setWeightKg(dto.weightKg());
        e.setSterilized(dto.sterilized());
        e.setMicrochip(dto.microchip());
        e.setDewormedAt(dto.dewormedAt());
        e.setVetName(dto.vetName());
        e.setMedicalNotes(dto.medicalNotes());
        e.setVaccines(toVaccineEntities(dto.vaccines(), e));

        if (dto.images() != null && !dto.images().isEmpty()) {
            List<String> urls = dto.images().stream()
                    .filter(url -> url != null && !url.isBlank())
                    .toList();
            List<ImageEntity> images = new ArrayList<>();
            for (int i = 0; i < urls.size(); i++) {
                ImageEntity image = new ImageEntity();
                image.setUrlImage(urls.get(i));
                image.setIsPrimary(i == 0);        // la primera = principal (mejor)
                image.setPosition(i + 1);          // numeracion 1..N
                image.setCreatedAt(LocalDateTime.now());
                image.setPet(e);
                images.add(image);
            }
            e.setImages(images);
        }

        return e;
    }

    /** Convierte una lista de VaccineDTO a entidades enlazadas a la mascota. */
    public static List<VaccineEntity> toVaccineEntities(List<VaccineDTO> dtos, PetsEntity pet) {
        List<VaccineEntity> result = new ArrayList<>();
        if (dtos == null) {
            return result;
        }
        for (VaccineDTO v : dtos) {
            if (v == null || v.name() == null || v.name().isBlank()) {
                continue;
            }
            VaccineEntity ve = new VaccineEntity();
            ve.setName(v.name().trim());
            ve.setAppliedAt(v.appliedAt());
            ve.setNextDoseAt(v.nextDoseAt());
            ve.setVet(v.vet());
            ve.setLot(v.lot());
            ve.setPet(pet);
            ve.setCreatedAt(LocalDateTime.now());
            result.add(ve);
        }
        return result;
    }
}
