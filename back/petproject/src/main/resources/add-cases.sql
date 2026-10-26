CREATE TABLE IF NOT EXISTS cases (
    case_id SERIAL PRIMARY KEY,
    case_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    pet_id INTEGER NULL REFERENCES pets(pet_id) ON DELETE SET NULL,
    report_id INTEGER NULL REFERENCES lost_pets(report_id) ON DELETE SET NULL,
    adoption_request_id INTEGER NULL REFERENCES adoption_requests(request_id) ON DELETE SET NULL,
    report_sighting_id INTEGER NULL REFERENCES report_sightings(sighting_id) ON DELETE SET NULL,
    owner_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    participant_id INTEGER NULL REFERENCES users(user_id) ON DELETE SET NULL,
    title VARCHAR(180) NOT NULL,
    last_message VARCHAR(2000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_messages (
    message_id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    sender_id INTEGER NULL REFERENCES users(user_id) ON DELETE SET NULL,
    sender_name VARCHAR(150),
    message VARCHAR(2000) NOT NULL,
    image_urls TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE case_messages
    ADD COLUMN IF NOT EXISTS image_urls TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cases_adoption_request
    ON cases(adoption_request_id)
    WHERE adoption_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cases_report_sighting
    ON cases(report_sighting_id)
    WHERE report_sighting_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_cases_owner ON cases(owner_id);
CREATE INDEX IF NOT EXISTS ix_cases_participant ON cases(participant_id);
CREATE INDEX IF NOT EXISTS ix_case_messages_case ON case_messages(case_id);
