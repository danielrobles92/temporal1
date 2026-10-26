package com.example.pets.petproject.application;

import com.example.pets.petproject.domain.enums.UserRole;
import com.example.pets.petproject.domain.model.CreateUserDTO;
import com.example.pets.petproject.domain.model.PasswordUpdatedDTO;
import com.example.pets.petproject.domain.model.UserDTO;
import com.example.pets.petproject.domain.service.UserService;
import com.example.pets.petproject.security.AuthUtils;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/users")
@CrossOrigin
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserDTO> getAllUsers() {
        return userService.getAllUsers();
    }

    @PostMapping
    public UserDTO createUser(@RequestBody CreateUserDTO dto) {
        // Anti-escalada: el registro publico SIEMPRE crea USER. Solo un admin
        // autenticado puede asignar SHELTER/ADMIN.
        UserRole role = AuthUtils.isAdmin() ? dto.role() : UserRole.USER;
        CreateUserDTO safe = new CreateUserDTO(dto.username(), dto.email(), dto.phone(), dto.password(), role);
        return userService.createUser(safe);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Integer id) {
        requireSelfOrAdmin(id);
        userService.deleteUser(id);
    }

    @GetMapping("/find/{username}")
    public UserDTO findUser(@PathVariable String username) {
        return userService.getByEmail(username);
    }

    @PutMapping("/update/{id}")
    public UserDTO updateData(@PathVariable Integer id, @RequestBody UserDTO dto) {
        requireSelfOrAdmin(id);
        return userService.updateUser(id, dto);
    }

    @PutMapping("/update/password/{id}")
    public UserDTO updatePassword(@PathVariable Integer id, @RequestBody PasswordUpdatedDTO dto) {
        requireSelfOrAdmin(id);
        return userService.updatePassword(id, dto.newPassword());
    }

    /** Solo el propio usuario o un admin pueden modificar/eliminar la cuenta. */
    private void requireSelfOrAdmin(Integer id) {
        if (!AuthUtils.isSelfOrAdmin(id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No autorizado");
        }
    }

    @PatchMapping("/{id}/role")
    public UserDTO updateRole(@PathVariable Integer id, @RequestBody java.util.Map<String, String> body) {
        return userService.updateRole(id, body.get("role"));
    }

    @PatchMapping("/{id}/publishing-authorization")
    public UserDTO updatePublishingAuthorization(@PathVariable Integer id, @RequestBody java.util.Map<String, Boolean> body) {
        return userService.updatePublishingAuthorization(id, body.get("authorized"));
    }

    @PatchMapping("/{id}/status")
    public UserDTO updateAccountStatus(@PathVariable Integer id, @RequestBody java.util.Map<String, Boolean> body) {
        return userService.updateAccountStatus(id, body.get("active"));
    }


}
