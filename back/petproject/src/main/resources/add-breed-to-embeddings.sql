-- Migracion: guardar la raza predicha (clasificador mx20) por imagen de mascota.
-- Ejecutar conectado a la base pet_adoption. Idempotente y aditiva.
-- La raza se usa como FILTRO en el matching (mismo perro => misma raza).

ALTER TABLE pet_image_embeddings
    ADD COLUMN IF NOT EXISTS breed VARCHAR(80),
    ADD COLUMN IF NOT EXISTS breed_confidence REAL;

CREATE INDEX IF NOT EXISTS idx_pet_image_embeddings_breed ON pet_image_embeddings(breed);
