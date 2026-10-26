package com.example.pets.petproject.infraestructure.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "report_sightings")
public class ReportSightingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sighting_id")
    private Integer sightingId;

    @Column(name = "report_id", nullable = false)
    private Integer reportId;

    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "contact_name", nullable = false, length = 150)
    private String contactName;

    @Column(name = "contact_email", length = 180)
    private String contactEmail;

    @Column(name = "contact_phone", length = 40)
    private String contactPhone;

    @Column(name = "location", length = 255)
    private String location;

    @Column(name = "message", nullable = false, length = 2000)
    private String message;

    @Column(name = "image_urls", length = 4000)
    private String imageUrls;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "NEW";

    @Column(name = "owner_reply", length = 2000)
    private String ownerReply;

    @Column(name = "case_opened_at")
    private LocalDateTime caseOpenedAt;

    @Column(name = "replied_at")
    private LocalDateTime repliedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Integer getSightingId() {
        return sightingId;
    }

    public Integer getReportId() {
        return reportId;
    }

    public void setReportId(Integer reportId) {
        this.reportId = reportId;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public String getContactName() {
        return contactName;
    }

    public void setContactName(String contactName) {
        this.contactName = contactName;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public void setContactEmail(String contactEmail) {
        this.contactEmail = contactEmail;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public void setContactPhone(String contactPhone) {
        this.contactPhone = contactPhone;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getImageUrls() {
        return imageUrls;
    }

    public void setImageUrls(String imageUrls) {
        this.imageUrls = imageUrls;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOwnerReply() {
        return ownerReply;
    }

    public void setOwnerReply(String ownerReply) {
        this.ownerReply = ownerReply;
    }

    public LocalDateTime getCaseOpenedAt() {
        return caseOpenedAt;
    }

    public void setCaseOpenedAt(LocalDateTime caseOpenedAt) {
        this.caseOpenedAt = caseOpenedAt;
    }

    public LocalDateTime getRepliedAt() {
        return repliedAt;
    }

    public void setRepliedAt(LocalDateTime repliedAt) {
        this.repliedAt = repliedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
