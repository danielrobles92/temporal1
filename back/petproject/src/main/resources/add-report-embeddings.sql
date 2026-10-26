-- Matching reporte<->reporte (perdido<->encontrado) y reporte<->mascota.
-- Idempotente y aditiva. Ejecutar conectado a la base pet_adoption.

-- 1. Embeddings + raza de las imagenes de reportes (una por reporte).
CREATE TABLE IF NOT EXISTS report_image_embeddings (
    embedding_id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL,
    model VARCHAR(50) NOT NULL DEFAULT 'efficientnet_b0',
    dim INTEGER NOT NULL DEFAULT 1280,
    embedding REAL[] NOT NULL,
    breed VARCHAR(80),
    breed_confidence REAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_report_image_embeddings_report
        FOREIGN KEY (report_id) REFERENCES lost_pets(report_id) ON DELETE CASCADE,
    CONSTRAINT ux_report_image_embeddings_report UNIQUE (report_id)
);
CREATE INDEX IF NOT EXISTS idx_report_image_embeddings_report ON report_image_embeddings(report_id);
CREATE INDEX IF NOT EXISTS idx_report_image_embeddings_breed ON report_image_embeddings(breed);

-- 2. matches: el objetivo de una coincidencia puede ser otro REPORTE (no solo un pet).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS matched_report_id INTEGER;
ALTER TABLE matches ALTER COLUMN pet_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_matches_matched_report') THEN
        ALTER TABLE matches
            ADD CONSTRAINT fk_matches_matched_report
            FOREIGN KEY (matched_report_id) REFERENCES lost_pets(report_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Unicidad para coincidencias reporte<->reporte.
CREATE UNIQUE INDEX IF NOT EXISTS ux_matches_report_matchedreport
    ON matches(report_id, matched_report_id) WHERE matched_report_id IS NOT NULL;
