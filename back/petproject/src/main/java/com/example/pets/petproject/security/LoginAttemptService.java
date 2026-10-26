package com.example.pets.petproject.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Proteccion simple contra fuerza bruta en el login: cuenta intentos fallidos
 * por correo y bloquea temporalmente al superar el maximo. En memoria (suficiente
 * para el prototipo; en produccion conviene Redis o BD para multi-instancia).
 */
@Service
public class LoginAttemptService {

    private final int maxAttempts;
    private final long lockMillis;
    private final ConcurrentHashMap<String, AtomicInteger> attempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lockedUntil = new ConcurrentHashMap<>();

    public LoginAttemptService(
            @Value("${security.login.max-attempts:5}") int maxAttempts,
            @Value("${security.login.lock-minutes:15}") long lockMinutes
    ) {
        this.maxAttempts = maxAttempts;
        this.lockMillis = lockMinutes * 60_000L;
    }

    private String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public boolean isLocked(String email) {
        Long until = lockedUntil.get(key(email));
        if (until == null) {
            return false;
        }
        if (System.currentTimeMillis() >= until) {
            lockedUntil.remove(key(email));
            attempts.remove(key(email));
            return false;
        }
        return true;
    }

    public void onFailure(String email) {
        String k = key(email);
        int count = attempts.computeIfAbsent(k, x -> new AtomicInteger()).incrementAndGet();
        if (count >= maxAttempts) {
            lockedUntil.put(k, System.currentTimeMillis() + lockMillis);
        }
    }

    public void onSuccess(String email) {
        String k = key(email);
        attempts.remove(k);
        lockedUntil.remove(k);
    }
}
