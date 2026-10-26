package com.example.pets.petproject.domain.service;

import com.example.pets.petproject.domain.model.CreateUserDTO;
import com.example.pets.petproject.domain.model.UserDTO;
import org.apache.catalina.User;

import java.util.List;

public interface UserService {

    List<UserDTO> getAllUsers();

    UserDTO getByEmail(String email);

    UserDTO createUser(CreateUserDTO dto);

    UserDTO updateUser(Integer id, UserDTO dto);

    UserDTO updatePassword(Integer id, String newPassword);

    UserDTO updateRole(Integer id, String role);

    UserDTO updatePublishingAuthorization(Integer id, Boolean authorized);

    UserDTO updateAccountStatus(Integer id, Boolean active);

    void deleteUser(Integer id);

}
