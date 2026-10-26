package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.ReportImageEmbeddingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ReportImageEmbeddingRepositoryDB extends JpaRepository<ReportImageEmbeddingEntity, Integer> {

    List<ReportImageEmbeddingEntity> findByReportIdIn(Collection<Integer> reportIds);

    boolean existsByReportId(Integer reportId);
}
