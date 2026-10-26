package com.example.pets.petproject.domain.port;

import com.example.pets.petproject.infraestructure.entity.NotificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepositoryDB extends JpaRepository<NotificationEntity, Integer> {

    List<NotificationEntity> findTop50ByUserIdOrderByCreatedAtDesc(Integer userId);

    long countByUserIdAndIsReadFalse(Integer userId);

    @Modifying
    @Query("UPDATE NotificationEntity n SET n.isRead = true WHERE n.userId = :userId AND n.isRead = false")
    int markAllRead(@Param("userId") Integer userId);
}
