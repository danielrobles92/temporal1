-- Ejecutar conectado a la base pet_adoption.
-- Corrige columnas de imagen para soportar Data URL/base64.

ALTER TABLE pet_images
    ALTER COLUMN url_image TYPE TEXT;

ALTER TABLE lost_pets
    ALTER COLUMN image_url TYPE TEXT;
