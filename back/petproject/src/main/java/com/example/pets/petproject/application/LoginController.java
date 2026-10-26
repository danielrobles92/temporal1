package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.model.LoginRequestDTO;
import com.example.pets.petproject.domain.model.LoginResponseDTO;
import com.example.pets.petproject.domain.service.LoginService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class LoginController {

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    public LoginResponseDTO login(@RequestBody final LoginRequestDTO dto) {
        return loginService.login(dto);
    }
}
