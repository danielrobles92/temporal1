package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.domain.enums.AuthorizationRequestStatus;
import com.example.pets.petproject.infraestructure.entity.PublicationAuthorizationRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuthorizationRequestRepositoryDB extends JpaRepository<PublicationAuthorizationRequestEntity, Integer> {
    List<PublicationAuthorizationRequestEntity> findByUserId(Integer userId);
    boolean existsByUserIdAndStatus(Integer userId, AuthorizationRequestStatus status);
}
