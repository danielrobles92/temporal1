package com.example.pets.petproject.domain.service;

import com.example.pets.petproject.domain.model.CreatedPetsDTO;
import com.example.pets.petproject.domain.model.PetsDTO;
import com.example.pets.petproject.domain.enums.PetStatus;
import org.springframework.data.domain.Page;

import java.util.List;

public interface PetsService {

    Page<PetsDTO> getAllPets(int page, int size, PetStatus status);

    PetsDTO getPetById(Integer id);

    PetsDTO createPet(CreatedPetsDTO dto);

    PetsDTO updatePet(Integer id, PetsDTO dto);

    PetsDTO updatePetWithImages(Integer id, PetsDTO dto, List<String> imagePaths);

    PetsDTO deactivatePet(Integer id);

    List<PetsDTO> getPetsByOwner(Integer ownerId);

    void deleteById(Integer id);


}
