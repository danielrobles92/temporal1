-- Migracion: almacenamiento de embeddings de imagenes y coincidencias (matches).
-- Ejecutar conectado a la base pet_adoption (no a postgres), en pgAdmin o psql.
-- Idempotente: se puede volver a ejecutar sin recrear lo existente.
--
-- Nota sobre el almacenamiento de embeddings:
-- En esta etapa el vector se guarda como arreglo nativo REAL[] (sin la extension
-- pgvector). La similitud del coseno se calcula en el backend sobre los candidatos
-- ya filtrados (especie/estado/geolocalizacion), lo que es exacto y suficiente para
-- el dataset acotado del prototipo. Cuando el catalogo crezca, se puede migrar la
-- columna `embedding` a tipo `vector(1280)` (pgvector) y anadir un indice HNSW sin
-- cambiar el resto del modelo de datos.
--
-- Estas tablas son ADITIVAS: no modifican pets, pet_images ni lost_pets, por lo que
-- el complemento de carga de imagenes/ubicaciones sigue funcionando igual.

-- 1. Embeddings de imagenes de mascotas (una fila por imagen de pet_images).
CREATE TABLE IF NOT EXISTS pet_image_embeddings (
    embedding_id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL,
    model VARCHAR(50) NOT NULL DEFAULT 'efficientnet_b0',
    dim INTEGER NOT NULL DEFAULT 1280,
    embedding REAL[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pet_image_embeddings_image
        FOREIGN KEY (image_id) REFERENCES pet_images(image_id) ON DELETE CASCADE,
    CONSTRAINT ux_pet_image_embeddings_image UNIQUE (image_id)
);

CREATE INDEX IF NOT EXISTS idx_pet_image_embeddings_image_id ON pet_image_embeddings(image_id);

-- 2. Coincidencias potenciales entre reportes de extravio/hallazgo y mascotas.
-- Cubre RF-31..RF-34: detectar, mostrar, consultar y validar/rechazar/descartar.
-- score = puntaje hibrido (visual + atributos); status sigue el ciclo de vida de la
-- coincidencia.
CREATE TABLE IF NOT EXISTS matches (
    match_id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL,
    pet_id INTEGER NOT NULL,
    visual_score REAL,         -- similitud del coseno 0..1 (lado imagen)
    attribute_score INTEGER,   -- puntaje por reglas (raza/sexo/color/ubicacion)
    score REAL NOT NULL,       -- puntaje hibrido final
    reason VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'SUGGESTED'
        CHECK (status IN ('SUGGESTED', 'VALIDATED', 'REJECTED', 'DISCARDED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_matches_report
        FOREIGN KEY (report_id) REFERENCES lost_pets(report_id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_pet
        FOREIGN KEY (pet_id) REFERENCES pets(pet_id) ON DELETE CASCADE,
    CONSTRAINT ux_matches_report_pet UNIQUE (report_id, pet_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_report_id ON matches(report_id);
CREATE INDEX IF NOT EXISTS idx_matches_pet_id ON matches(pet_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
