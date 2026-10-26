package com.example.pets.petproject.domain.service;

import com.example.pets.petproject.domain.model.LoginRequestDTO;
import com.example.pets.petproject.domain.model.LoginResponseDTO;

public interface LoginService {
    LoginResponseDTO login(LoginRequestDTO loginRequestDTO);
}
