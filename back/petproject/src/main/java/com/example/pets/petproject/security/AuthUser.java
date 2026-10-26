package com.example.pets.petproject.security;

/** Identidad autenticada extraida del JWT (principal en el SecurityContext). */
public record AuthUser(Integer id, String username, String role, boolean publishingAuthorized) {}
