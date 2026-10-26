package com.example.pets.petproject.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Lee el JWT del header Authorization (si existe y es valido) y coloca la
 * identidad en el SecurityContext con sus authorities (ROLE_*). Si no hay token
 * o es invalido, la peticion continua sin autenticar y SecurityConfig decide.
 */
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = jwtUtil.extractClaims(header.substring(7));
                String role = claims.get("role", String.class);
                if (role == null) {
                    role = Boolean.TRUE.equals(claims.get("admin", Boolean.class)) ? "ADMIN" : "USER";
                }
                boolean pub = Boolean.TRUE.equals(claims.get("pub", Boolean.class));
                Integer id = claims.get("id", Integer.class);

                List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
                if (pub || "ADMIN".equals(role) || "SHELTER".equals(role)) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_PUBLISHER"));
                }

                AuthUser principal = new AuthUser(id, claims.getSubject(), role, pub);
                var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // Token invalido/expirado: continuar sin autenticar.
                SecurityContextHolder.clearContext();
            }
        }

        chain.doFilter(request, response);
    }
}
