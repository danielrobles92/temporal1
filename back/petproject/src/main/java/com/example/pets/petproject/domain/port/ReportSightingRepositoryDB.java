package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.ReportSightingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportSightingRepositoryDB extends JpaRepository<ReportSightingEntity, Integer> {
    List<ReportSightingEntity> findByReportIdOrderByCreatedAtDesc(Integer reportId);
}
