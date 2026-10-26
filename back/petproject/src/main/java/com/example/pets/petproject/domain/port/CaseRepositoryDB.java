package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.CaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CaseRepositoryDB extends JpaRepository<CaseEntity, Integer> {
    List<CaseEntity> findByOwnerIdOrParticipantIdOrderByUpdatedAtDesc(Integer ownerId, Integer participantId);
    Optional<CaseEntity> findByAdoptionRequestId(Integer adoptionRequestId);
    Optional<CaseEntity> findByReportSightingId(Integer reportSightingId);
}
