package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.domain.enums.MatchStatus;
import com.example.pets.petproject.infraestructure.entity.MatchEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchRepositoryDB extends JpaRepository<MatchEntity, Integer> {

    List<MatchEntity> findByReportIdOrderByScoreDesc(Integer reportId);

    List<MatchEntity> findByReportIdAndStatusOrderByScoreDesc(Integer reportId, MatchStatus status);

    Optional<MatchEntity> findByReportIdAndPetId(Integer reportId, Integer petId);

    Optional<MatchEntity> findByReportIdAndMatchedReportId(Integer reportId, Integer matchedReportId);
}
