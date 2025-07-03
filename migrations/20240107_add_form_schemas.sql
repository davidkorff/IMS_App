-- Add form schemas table
CREATE TABLE IF NOT EXISTS form_schemas (
    form_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id INTEGER NOT NULL REFERENCES ims_instances(instance_id),
    lob_id UUID REFERENCES portal_lines_of_business(lob_id),
    schema_version VARCHAR(10) DEFAULT '1.0',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    form_schema JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id),
    updated_by INTEGER REFERENCES users(user_id)
);

-- Add indexes
CREATE INDEX idx_form_schemas_instance ON form_schemas(instance_id);
CREATE INDEX idx_form_schemas_lob ON form_schemas(lob_id);
CREATE INDEX idx_form_schemas_active ON form_schemas(is_active);
CREATE INDEX idx_form_schemas_template ON form_schemas(is_template);

-- Add form_schema_id to LOB table
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS form_schema_id UUID REFERENCES form_schemas(form_id);

-- Create form submissions table to store form data
CREATE TABLE IF NOT EXISTS form_submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES form_schemas(form_id),
    producer_id UUID REFERENCES producers(producer_id),
    submission_guid UUID REFERENCES producer_submissions(submission_guid),
    form_data JSONB NOT NULL,
    form_state JSONB,
    is_draft BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_producer ON form_submissions(producer_id);
CREATE INDEX idx_form_submissions_submission ON form_submissions(submission_guid);
CREATE INDEX idx_form_submissions_draft ON form_submissions(is_draft);

-- Create form templates table
CREATE TABLE IF NOT EXISTS form_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id INTEGER NOT NULL REFERENCES ims_instances(instance_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_schema JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id)
);

-- Add indexes
CREATE INDEX idx_form_templates_instance ON form_templates(instance_id);
CREATE INDEX idx_form_templates_category ON form_templates(category);
CREATE INDEX idx_form_templates_public ON form_templates(is_public);