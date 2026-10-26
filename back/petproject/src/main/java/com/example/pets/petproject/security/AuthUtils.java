package com.example.pets.petproject.security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Utilidades para leer la identidad autenticada desde el SecurityContext. */
public final class AuthUtils {

    private AuthUtils() {}

    public static AuthUser current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return (auth.getPrincipal() instanceof AuthUser u) ? u : null;
    }

    public static Integer currentUserId() {
        AuthUser u = current();
        return u != null ? u.id() : null;
    }

    public static boolean isAdmin() {
        AuthUser u = current();
        return u != null && "ADMIN".equals(u.role());
    }

    /** true si el usuario autenticado es admin o es el propio duenio del recurso. */
    public static boolean isSelfOrAdmin(Integer ownerId) {
        if (isAdmin()) {
            return true;
        }
        Integer me = currentUserId();
        return me != null && me.equals(ownerId);
    }
}
