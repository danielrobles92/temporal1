package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.domain.enums.ReportType;
import com.example.pets.petproject.infraestructure.entity.LostPetReportEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LostPetReportRepositoryDB extends JpaRepository<LostPetReportEntity, Integer> {
    List<LostPetReportEntity> findByReporterId(Integer reporterId);
    List<LostPetReportEntity> findByType(ReportType type);
}
