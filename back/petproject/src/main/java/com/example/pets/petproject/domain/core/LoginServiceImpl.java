package com.example.pets.petproject.domain.core;

import com.example.pets.petproject.domain.enums.UserRole;
import com.example.pets.petproject.domain.model.LoginRequestDTO;
import com.example.pets.petproject.domain.model.LoginResponseDTO;
import com.example.pets.petproject.domain.port.UserRepositoryDB;
import com.example.pets.petproject.domain.service.LoginService;
import com.example.pets.petproject.infraestructure.entity.UserEntity;
import com.example.pets.petproject.security.JwtUtil;
import com.example.pets.petproject.security.LoginAttemptService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import at.favre.lib.crypto.bcrypt.BCrypt;

import static com.example.pets.petproject.utils.Constants.*;

@Service
public class LoginServiceImpl implements LoginService {

    // Mensaje generico: NO revelar si fallo el correo o la contrasena (anti-enumeracion).
    private static final String INVALID_CREDENTIALS = "Correo o contrasena incorrectos";

    @Autowired
    private UserRepositoryDB userRepositoryDB;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private LoginAttemptService loginAttemptService;

    @Override
    public LoginResponseDTO login(final LoginRequestDTO dto) {

        // Bloqueo temporal por demasiados intentos fallidos (fuerza bruta).
        if (loginAttemptService.isLocked(dto.email())) {
            return new LoginResponseDTO(false,
                    "Demasiados intentos fallidos. Intenta de nuevo en unos minutos.",
                    null, null, null, null, null, null);
        }

        UserEntity user = userRepositoryDB.findByEmail(dto.email()).orElse(null);

        if (user == null) {
            loginAttemptService.onFailure(dto.email());
            return new LoginResponseDTO(false, INVALID_CREDENTIALS, null, null, null, null, null, null);
        }

        if (Boolean.FALSE.equals(user.getAccountActive())) {
            return new LoginResponseDTO(false, "Cuenta desactivada", null, null, null, null, null, null);
        }

        boolean matches = BCrypt.verifyer()
                .verify(dto.password().toCharArray(), user.getPassword())
                .verified;

        if (!matches) {
            loginAttemptService.onFailure(dto.email());
            return new LoginResponseDTO(false, INVALID_CREDENTIALS, null, null, null, null, null, null);
        }

        loginAttemptService.onSuccess(dto.email());

        String token = jwtUtil.generateToken(
                user.getUsername(),
                user.getRole().name(),
                user.getId(),
                Boolean.TRUE.equals(user.getPublishingAuthorized())
        );

        return new LoginResponseDTO(
                true,
                SUCCESS,
                user.getUsername(),
                user.getRole() == UserRole.ADMIN,
                user.getId(),
                token,
                user.getRole().name(),
                user.getPublishingAuthorized()
        );
    }
}
