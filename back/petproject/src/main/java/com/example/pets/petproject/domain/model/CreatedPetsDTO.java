package com.example.pets.petproject.domain.model;

import com.example.pets.petproject.domain.enums.PetSex;
import com.example.pets.petproject.domain.enums.PetSpecies;
import com.example.pets.petproject.domain.enums.PetStatus;

import java.time.LocalDate;
import java.util.List;

public record CreatedPetsDTO(
    Integer ownerId,
    String name,
    PetSpecies species,
    String breed,
    PetSex sex,
    String color,
    Integer age,
    String description,
    String location,
    Double latitude,
    Double longitude,
    PetStatus status,
    List<String> images,
    // --- Cartilla / datos de salud ---
    LocalDate birthDate,
    Double weightKg,
    Boolean sterilized,
    String microchip,
    LocalDate dewormedAt,
    String vetName,
    String medicalNotes,
    List<VaccineDTO> vaccines
    ) {

}
