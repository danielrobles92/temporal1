-- Ejecutar conectado a la base pet_adoption.
-- Deja una sola solicitud por usuario y perro.

DELETE FROM adoption_requests ar
USING adoption_requests duplicated
WHERE ar.pet_id = duplicated.pet_id
  AND ar.user_id = duplicated.user_id
  AND ar.request_id < duplicated.request_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_adoption_requests_pet_user
ON adoption_requests(pet_id, user_id);
