package com.example.pets.petproject.domain.core;

import com.example.pets.petproject.domain.enums.PetStatus;
import com.example.pets.petproject.domain.mapper.PetsMapper;
import com.example.pets.petproject.domain.mapper.UserMapper;
import com.example.pets.petproject.domain.model.CreatedPetsDTO;
import com.example.pets.petproject.domain.model.PetsDTO;
import com.example.pets.petproject.domain.model.UserDTO;
import com.example.pets.petproject.domain.port.PetsRepositoryDB;
import com.example.pets.petproject.domain.port.UserRepositoryDB;
import com.example.pets.petproject.domain.service.PetsService;
import com.example.pets.petproject.infraestructure.entity.PetsEntity;
import com.example.pets.petproject.infraestructure.entity.UserEntity;
import com.example.pets.petproject.utils.Constants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class PetsServiceImpl implements PetsService {

    private final PetsRepositoryDB repository;
    private final UserRepositoryDB userRepository;
    private final ImageEmbeddingService imageEmbeddingService;

    public PetsServiceImpl(PetsRepositoryDB repository, UserRepositoryDB userRepository,
                           ImageEmbeddingService imageEmbeddingService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.imageEmbeddingService = imageEmbeddingService;
    }

    /** Genera embeddings de las imagenes de la mascota sin interrumpir el flujo si falla. */
    private void embedImagesSafely(PetsEntity pet) {
        try {
            imageEmbeddingService.embedPetImages(pet);
        } catch (Exception e) {
            log.warn("No se pudieron generar embeddings para la mascota {}: {}",
                    pet.getPetId(), e.getMessage());
        }
    }

    private PetsDTO toDtoWithOwner(PetsEntity pet) {
        String ownerName = pet.getOwnerId() == null ? null : userRepository.findById(pet.getOwnerId())
                .map(UserEntity::getUsername)
                .orElse(null);
        return PetsMapper.toDto(pet, ownerName);
    }

    @Override
    public Page<PetsDTO> getAllPets(int page, int size, PetStatus status) {
        Pageable pageable = PageRequest.of(page, size);

        if (status != null) {
            return repository.findByStatus(status, pageable).map(this::toDtoWithOwner);
        }

        return repository.findAll(pageable).map(this::toDtoWithOwner);
    }

    @Override
    public PetsDTO createPet(CreatedPetsDTO dto) {
        PetsEntity entity = PetsMapper.toEntity(dto);

        PetsEntity saved = repository.save(entity);
        embedImagesSafely(saved);
        return toDtoWithOwner(saved);
    }

    @Override
    public void deleteById(Integer id) {
        repository.deleteById(id);
    }

    @Override
    public PetsDTO getPetById(Integer id) {
        try{
            Optional<PetsEntity> pet = repository.findById(id);

            if(pet.isEmpty()){
                throw new RuntimeException(Constants.PET_NOT_FOUND);
            }

            return toDtoWithOwner(pet.get());
        } catch(Exception e){
            throw new RuntimeException(Constants.PET_NOT_FOUND);
        }
    }

    @Override
    public PetsDTO updatePet(Integer id, PetsDTO dto) {
        PetsEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Mascota no encontrada")
        );

        applyPetUpdate(existing, dto);

        PetsEntity updated = repository.save(existing);
        return toDtoWithOwner(updated);
    }

    @Override
    public PetsDTO updatePetWithImages(Integer id, PetsDTO dto, List<String> imagePaths) {
        PetsEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Mascota no encontrada")
        );

        applyPetUpdate(existing, dto);

        boolean imagesChanged = imagePaths != null && !imagePaths.isEmpty();
        if (imagesChanged) {
            replaceImages(existing, imagePaths);
        }

        PetsEntity updated = repository.save(existing);
        if (imagesChanged) {
            embedImagesSafely(updated);
        }
        return toDtoWithOwner(updated);
    }

    private void applyPetUpdate(PetsEntity existing, PetsDTO dto) {
        existing.setName(dto.name());
        existing.setAge(dto.age());
        existing.setColor(dto.color());
        existing.setBreed(dto.breed());
        existing.setDescription(dto.description());
        existing.setLocation(dto.location());
        existing.setLatitude(dto.latitude());
        existing.setLongitude(dto.longitude());
        existing.setStatus(dto.status());

        // Cartilla / salud
        existing.setBirthDate(dto.birthDate());
        existing.setWeightKg(dto.weightKg());
        existing.setSterilized(dto.sterilized());
        existing.setMicrochip(dto.microchip());
        existing.setDewormedAt(dto.dewormedAt());
        existing.setVetName(dto.vetName());
        existing.setMedicalNotes(dto.medicalNotes());
        if (dto.vaccines() != null) {
            replaceVaccines(existing, dto.vaccines());
        }
    }

    private void replaceVaccines(PetsEntity existing, java.util.List<com.example.pets.petproject.domain.model.VaccineDTO> vaccines) {
        if (existing.getVaccines() == null) {
            existing.setVaccines(new ArrayList<>());
        } else {
            existing.getVaccines().clear();
        }
        existing.getVaccines().addAll(
                com.example.pets.petproject.domain.mapper.PetsMapper.toVaccineEntities(vaccines, existing));
    }

    private void replaceImages(PetsEntity existing, List<String> imagePaths) {
        if (existing.getImages() == null) {
            existing.setImages(new ArrayList<>());
        } else {
            existing.getImages().clear();
        }

        int pos = 0;
        for (String path : imagePaths) {
            if (path == null || path.isBlank()) {
                continue;
            }
            var image = new com.example.pets.petproject.infraestructure.entity.ImageEntity();
            image.setUrlImage(path);
            image.setIsPrimary(pos == 0);          // la primera = principal (mejor)
            image.setPosition(pos + 1);            // numeracion 1..N
            image.setCreatedAt(LocalDateTime.now());
            image.setPet(existing);
            existing.getImages().add(image);
            pos++;
        }
    }

    @Override
    public PetsDTO deactivatePet(Integer id) {
        PetsEntity existing = repository.findById(id).orElseThrow(
                () -> new RuntimeException("Mascota no encontrada")
        );
        existing.setStatus(PetStatus.ADOPTED);
        return toDtoWithOwner(repository.save(existing));
    }

    @Override
    public List<PetsDTO> getPetsByOwner(Integer ownerId) {
        return repository.findByOwnerId(ownerId)
                .stream()
                .map(this::toDtoWithOwner)
                .toList();
    }




}
