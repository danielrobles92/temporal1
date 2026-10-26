-- Probabilidad calibrada de "es el mismo perro" por coincidencia. Idempotente/aditiva.
-- confidence in [0,1] = sigmoid(w*coseno + b) (ver ml-service/experiments/calibrate.py),
-- penalizada si la raza no coincide.

ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS confidence REAL;
