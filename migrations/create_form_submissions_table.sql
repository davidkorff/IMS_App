-- Create form submissions table with correct column types
CREATE TABLE IF NOT EXISTS form_submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES form_schemas(form_id),
    producer_id INTEGER REFERENCES producers(producer_id),
    submission_guid INTEGER REFERENCES producer_submissions(submission_id),
    form_data JSONB NOT NULL,
    form_state JSONB,
    is_draft BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_producer ON form_submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submission ON form_submissions(submission_guid);
CREATE INDEX IF NOT EXISTS idx_form_submissions_draft ON form_submissions(is_draft);