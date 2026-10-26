-- Orden/numeracion de las fotos de mascota (foto 1..4). Idempotente y aditiva.
-- position = orden de visualizacion; la foto principal (is_primary) es la position 1.

ALTER TABLE pet_images
    ADD COLUMN IF NOT EXISTS position INTEGER;

-- Backfill de filas existentes: numera por mascota, la principal primero.
UPDATE pet_images pi
SET position = sub.rn
FROM (
    SELECT image_id,
           ROW_NUMBER() OVER (
               PARTITION BY pet_id
               ORDER BY is_primary DESC NULLS LAST, image_id
           ) AS rn
    FROM pet_images
) sub
WHERE pi.image_id = sub.image_id AND pi.position IS NULL;

CREATE INDEX IF NOT EXISTS idx_pet_images_position ON pet_images(pet_id, position);
