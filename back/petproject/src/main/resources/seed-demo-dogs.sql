DO $$
DECLARE
    v_owner_id INTEGER;
    v_pet_id INTEGER;
BEGIN
    SELECT user_id
    INTO v_owner_id
    FROM users
    ORDER BY
        CASE WHEN role::text IN ('ADMIN', 'SHELTER') THEN 0 ELSE 1 END,
        user_id
    LIMIT 1;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'No hay usuarios en users. Crea al menos un usuario antes de correr este script.';
    END IF;

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Toby', 'DOG', 'Mestizo', 'MALE', 'Cafe con blanco', 2, 'Perro sociable, jugueton y acostumbrado a convivir con personas.', 'Coyoacan - Del Carmen', 19.3490, -99.1620, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23eaf4ff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Toby</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Luna', 'DOG', 'Schnauzer', 'FEMALE', 'Gris', 3, 'Tranquila, esterilizada y apta para departamento.', 'Benito Juarez - Narvarte', 19.3890, -99.1550, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23fff7d6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Luna</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Rocky', 'DOG', 'Labrador Retriever', 'MALE', 'Negro', 4, 'Activo, obediente y con energia alta. Ideal para familia con patio.', 'Tlalpan - Centro', 19.2870, -99.1660, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23e8f6ee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Rocky</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Nala', 'DOG', 'Poodle', 'FEMALE', 'Blanco', 1, 'Cachorra pequena, carinosa y lista para proceso de adopcion.', 'Miguel Hidalgo - Polanco', 19.4330, -99.1910, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23f3eef7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Nala</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Max', 'DOG', 'Pastor Aleman', 'MALE', 'Negro y cafe', 5, 'Protector, inteligente y entrenado con comandos basicos.', 'Iztapalapa - Centro', 19.3570, -99.0920, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23f0f0e6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Max</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Mila', 'DOG', 'Chihuahua', 'FEMALE', 'Canela', 2, 'Pequena, alerta y muy apegada a las personas.', 'Azcapotzalco - Claveria', 19.4650, -99.1840, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23fff1e6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Mila</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Bruno', 'DOG', 'Golden Retriever', 'MALE', 'Dorado', 3, 'Muy noble, convive con ninos y disfruta paseos largos.', 'Cuauhtemoc - Roma Norte', 19.4190, -99.1600, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23fff8c9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Bruno</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO pets (owner_id, name, species, breed, sex, color, age, description, location, latitude, longitude, status, created_at)
    VALUES (v_owner_id, 'Kira', 'DOG', 'Husky Siberiano', 'FEMALE', 'Blanco y gris', 2, 'Energetica, requiere actividad diaria y familia responsable.', 'Venustiano Carranza - Jardin Balbuena', 19.4190, -99.1030, 'AVAILABLE', CURRENT_TIMESTAMP)
    RETURNING pet_id INTO v_pet_id;
    INSERT INTO pet_images (pet_id, url_image, is_primary, created_at) VALUES (v_pet_id, 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23e9eef7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Kira</text></svg>', true, CURRENT_TIMESTAMP);

    INSERT INTO lost_pets (reporter_id, type, name, species, breed, sex, color, age, location, latitude, longitude, description, contact_phone, image_url, status, moderation_notes, created_at, updated_at)
    VALUES
    (v_owner_id, 'LOST', 'Canelo', 'DOG', 'Mestizo', 'MALE', 'Cafe', 4, 'Xochimilco - Centro', 19.2640, -99.1030, 'Se perdio cerca del mercado. Lleva collar azul.', '5512345678', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23ffe8dc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Canelo</text></svg>', 'OPEN', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (v_owner_id, 'LOST', 'Pelusa', 'DOG', 'Poodle', 'FEMALE', 'Blanco', 6, 'Coyoacan - Santa Ursula', 19.3150, -99.1520, 'Perra pequena, nerviosa, responde a su nombre.', '5523456789', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23f8fbff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Pelusa</text></svg>', 'OPEN', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (v_owner_id, 'LOST', 'Rex', 'DOG', 'Pastor Aleman', 'MALE', 'Negro y cafe', 5, 'Iztacalco - Agricola Oriental', 19.3900, -99.0700, 'Grande, collar rojo, ultimo avistamiento en parque.', '5534567890', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23e8f6ee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Rex</text></svg>', 'OPEN', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (v_owner_id, 'LOST', 'Chispa', 'DOG', 'Chihuahua', 'FEMALE', 'Cafe claro', 3, 'Benito Juarez - Portales', 19.3690, -99.1430, 'Muy pequena, se asusta con ruido fuerte.', '5545678901', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23fff3ec"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Chispa</text></svg>', 'OPEN', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (v_owner_id, 'LOST', 'Oso', 'DOG', 'Labrador Retriever', 'MALE', 'Negro', 7, 'Gustavo A. Madero - Lindavista', 19.4930, -99.1250, 'Perro grande, tranquilo, collar verde.', '5556789012', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="34" font-family="Arial">Oso</text></svg>', 'OPEN', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (v_owner_id, 'FOUND', 'Perrito encontrado en Tlalpan', 'DOG', 'Mestizo', 'MALE', 'Blanco con negro', 2, 'Tlalpan - San Pedro Martir', 19.2650, -99.1700, 'Perro encontrado con collar negro. Se resguarda temporalmente.', '5567890123', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320"><rect width="100%" height="100%" fill="%23ecfdf5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%230B5A97" font-size="30" font-family="Arial">Encontrado</text></svg>', 'OPEN', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
END $$;
