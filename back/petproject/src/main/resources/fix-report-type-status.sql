-- Ejecutar conectado a la base pet_adoption.
-- Mantiene perdido/encontrado como tipo de reporte, no como estatus.

ALTER TABLE lost_pets
    DROP CONSTRAINT IF EXISTS chk_lost_pets_type;

ALTER TABLE lost_pets
    ADD CONSTRAINT chk_lost_pets_type
    CHECK (type IN ('LOST', 'FOUND'));

ALTER TABLE lost_pets
    DROP CONSTRAINT IF EXISTS chk_lost_pets_status;

UPDATE lost_pets
SET status = 'OPEN'
WHERE status NOT IN ('OPEN', 'RESOLVED');

ALTER TABLE lost_pets
    ADD CONSTRAINT chk_lost_pets_status
    CHECK (status IN ('OPEN', 'RESOLVED'));
