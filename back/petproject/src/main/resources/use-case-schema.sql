-- Esquema completo para pet_adoption.
-- Ejecutar conectado a la base pet_adoption, no a la base postgres.
-- Este script es idempotente: se puede volver a ejecutar sin recrear lo existente.

CREATE EXTENSION IF NOT EXISTS postgis;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'SHELTER');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SHELTER' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'SHELTER';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'species') THEN
        CREATE TYPE species AS ENUM ('DOG', 'CAT', 'OTHER');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sex') THEN
        CREATE TYPE sex AS ENUM ('MALE', 'FEMALE');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
        CREATE TYPE status AS ENUM ('AVAILABLE', 'ADOPTED', 'LOST');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(60),
    role user_role NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    publishing_authorized BOOLEAN NOT NULL DEFAULT FALSE,
    account_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pets (
    pet_id SERIAL PRIMARY KEY,
    owner_id INTEGER,
    name VARCHAR(255) NOT NULL,
    species species NOT NULL,
    breed VARCHAR(255) NOT NULL,
    sex sex NOT NULL,
    color VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    description VARCHAR(500) NOT NULL,
    location VARCHAR(500) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_point geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                ELSE NULL
            END
        ) STORED,
    status status NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pets_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pet_images (
    image_id SERIAL PRIMARY KEY,
    pet_id INTEGER,
    url_image TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pet_images_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS publishing_authorized BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS account_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE pets
    ADD COLUMN IF NOT EXISTS owner_id INTEGER;

ALTER TABLE pet_images
    ALTER COLUMN url_image TYPE TEXT;

ALTER TABLE pets
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE pets
    ADD COLUMN IF NOT EXISTS location_point geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                ELSE NULL
            END
        ) STORED;

CREATE TABLE IF NOT EXISTS adoption_requests (
    request_id SERIAL PRIMARY KEY,
    pet_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(60),
    message VARCHAR(1000),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    decision_notes VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_adoption_requests_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(pet_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_adoption_requests_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS publication_authorization_requests (
    authorization_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    reason VARCHAR(1000),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    review_notes VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_authorization_requests_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lost_pets (
    report_id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('LOST', 'FOUND')),
    name VARCHAR(255) NOT NULL,
    species VARCHAR(30) NOT NULL,
    breed VARCHAR(255),
    sex VARCHAR(30),
    color VARCHAR(255),
    age INTEGER,
    location VARCHAR(500) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_point geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                ELSE NULL
            END
        ) STORED,
    description VARCHAR(1000),
    contact_phone VARCHAR(60),
    image_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    moderation_notes VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lost_pets_reporter
        FOREIGN KEY (reporter_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

ALTER TABLE lost_pets
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE lost_pets
    ALTER COLUMN image_url TYPE TEXT;

ALTER TABLE lost_pets
    ADD COLUMN IF NOT EXISTS location_point geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                ELSE NULL
            END
        ) STORED;

CREATE INDEX IF NOT EXISTS idx_pets_owner_id ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_location_point ON pets USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_pet_images_pet_id ON pet_images(pet_id);
CREATE INDEX IF NOT EXISTS idx_adoption_requests_user_id ON adoption_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_adoption_requests_pet_id ON adoption_requests(pet_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_adoption_requests_pet_user ON adoption_requests(pet_id, user_id);
CREATE INDEX IF NOT EXISTS idx_authorization_requests_user_id ON publication_authorization_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_lost_pets_reporter_id ON lost_pets(reporter_id);
CREATE INDEX IF NOT EXISTS idx_lost_pets_type ON lost_pets(type);
CREATE INDEX IF NOT EXISTS idx_lost_pets_location_point ON lost_pets USING GIST(location_point);

DELETE FROM pet_images WHERE url_image LIKE '%via.placeholder.com%';
UPDATE lost_pets SET image_url = NULL WHERE image_url LIKE '%via.placeholder.com%';
