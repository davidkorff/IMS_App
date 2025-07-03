-- Create form submissions table with correct column types and references
CREATE TABLE IF NOT EXISTS form_submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES form_schemas(form_id),
    producer_id INTEGER REFERENCES producers(producer_id),
    producer_submission_id INTEGER REFERENCES producer_submissions(id),  -- Reference to producer_submissions.id (primary key)
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
CREATE INDEX IF NOT EXISTS idx_form_submissions_producer_submission ON form_submissions(producer_submission_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_draft ON form_submissions(is_draft);

-- Add a comment to clarify the relationship
COMMENT ON COLUMN form_submissions.producer_submission_id IS 'References producer_submissions.id (the primary key)';