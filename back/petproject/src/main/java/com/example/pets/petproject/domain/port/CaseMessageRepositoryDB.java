package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.CaseMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaseMessageRepositoryDB extends JpaRepository<CaseMessageEntity, Integer> {
    List<CaseMessageEntity> findByCaseIdOrderByCreatedAtAsc(Integer caseId);
}
