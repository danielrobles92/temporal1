CREATE TABLE IF NOT EXISTS report_sightings (
    sighting_id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES lost_pets(report_id) ON DELETE CASCADE,
    user_id INTEGER NULL REFERENCES users(user_id) ON DELETE SET NULL,
    contact_name VARCHAR(150) NOT NULL,
    contact_email VARCHAR(180),
    contact_phone VARCHAR(40),
    location VARCHAR(255),
    message VARCHAR(2000) NOT NULL,
    image_urls VARCHAR(4000),
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    owner_reply VARCHAR(2000),
    case_opened_at TIMESTAMP,
    replied_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_sightings_report_id
    ON report_sightings(report_id);

ALTER TABLE report_sightings
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'NEW';

ALTER TABLE report_sightings
    ADD COLUMN IF NOT EXISTS owner_reply VARCHAR(2000);

ALTER TABLE report_sightings
    ADD COLUMN IF NOT EXISTS case_opened_at TIMESTAMP;

ALTER TABLE report_sightings
    ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;
