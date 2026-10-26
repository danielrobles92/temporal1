-- Cartilla / datos de salud del perro (solo aplica a publicaciones de mascotas).
-- Ejecutar conectado a la base pet_adoption. Idempotente y aditiva.

ALTER TABLE pets
    ADD COLUMN IF NOT EXISTS birth_date DATE,
    ADD COLUMN IF NOT EXISTS weight_kg DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS sterilized BOOLEAN,
    ADD COLUMN IF NOT EXISTS microchip VARCHAR(60),
    ADD COLUMN IF NOT EXISTS dewormed_at DATE,
    ADD COLUMN IF NOT EXISTS vet_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS medical_notes VARCHAR(1000);

-- Log de vacunas (una fila por vacuna aplicada), como en una cartilla real.
CREATE TABLE IF NOT EXISTS pet_vaccines (
    vaccine_id SERIAL PRIMARY KEY,
    pet_id INTEGER NOT NULL,
    name VARCHAR(120) NOT NULL,
    applied_at DATE,
    next_dose_at DATE,
    vet VARCHAR(255),
    lot VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pet_vaccines_pet
        FOREIGN KEY (pet_id) REFERENCES pets(pet_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pet_vaccines_pet_id ON pet_vaccines(pet_id);
