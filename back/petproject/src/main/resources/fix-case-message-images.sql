-- Agrega soporte para imagenes adjuntas en los mensajes de casos.
-- Ejecutar en la base de datos pet_adoption si la tabla case_messages ya existia.

ALTER TABLE case_messages
    ADD COLUMN IF NOT EXISTS image_urls TEXT;

-- Verificacion opcional:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'case_messages'
-- ORDER BY ordinal_position;
