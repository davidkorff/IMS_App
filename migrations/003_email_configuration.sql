-- Migration: Add email configuration to IMS instances
-- This supports both managed email and client-hosted email setups

-- Add email configuration column to instances table
ALTER TABLE ims_instances ADD COLUMN IF NOT EXISTS email_config JSONB DEFAULT NULL;

-- Add index for faster email config queries
CREATE INDEX IF NOT EXISTS idx_instances_email_config ON ims_instances USING GIN (email_config);

-- Add email configuration status enum for quick filtering
ALTER TABLE ims_instances ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT 'not_configured';

-- Add constraint for email status values
ALTER TABLE ims_instances ADD CONSTRAINT chk_email_status 
CHECK (email_status IN ('not_configured', 'configuring', 'active', 'error', 'disabled'));

-- Create email processing logs table for debugging and monitoring
CREATE TABLE IF NOT EXISTS email_processing_logs (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER REFERENCES ims_instances(instance_id),
    email_address VARCHAR(255),
    message_id VARCHAR(500),
    subject VARCHAR(500),
    control_number VARCHAR(50),
    processing_status VARCHAR(50), -- received, processing, filed, error
    error_message TEXT,
    attachments_count INTEGER DEFAULT 0,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    filed_to_ims BOOLEAN DEFAULT FALSE,
    ims_document_guid VARCHAR(100)
);

-- Index for email processing logs
CREATE INDEX IF NOT EXISTS idx_email_logs_instance ON email_processing_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_processing_logs(processing_status);
CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_processing_logs(processed_at);

-- Create email configurations table for secure credential storage
CREATE TABLE IF NOT EXISTS email_configurations (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER UNIQUE REFERENCES ims_instances(instance_id),
    config_type VARCHAR(20) NOT NULL, -- 'managed' or 'client_hosted'
    email_address VARCHAR(255) NOT NULL,
    
    -- For client-hosted configurations (encrypted)
    graph_client_id_encrypted TEXT,
    graph_client_secret_encrypted TEXT,
    graph_tenant_id_encrypted TEXT,
    
    -- Configuration metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_tested_at TIMESTAMP,
    test_status VARCHAR(20), -- success, failed, pending
    test_error TEXT,
    
    -- Email processing settings
    auto_extract_control_numbers BOOLEAN DEFAULT TRUE,
    control_number_patterns TEXT[], -- Array of regex patterns
    include_attachments BOOLEAN DEFAULT TRUE,
    default_folder_id INTEGER DEFAULT 3
);

-- Index for email configurations
CREATE INDEX IF NOT EXISTS idx_email_config_instance ON email_configurations(instance_id);
CREATE INDEX IF NOT EXISTS idx_email_config_type ON email_configurations(config_type);

-- Insert default control number patterns
UPDATE email_configurations 
SET control_number_patterns = ARRAY[
    '^(?:RE:\s*)?(\d{1,9})\b',  -- Control number at start, optionally with RE:
    '\b(\d{1,9})\b'             -- Any 1-9 digit number
] 
WHERE control_number_patterns IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN ims_instances.email_config IS 'JSON configuration for email processing (type, settings, status)';
COMMENT ON COLUMN ims_instances.email_status IS 'Quick status check: not_configured, configuring, active, error, disabled';
COMMENT ON TABLE email_configurations IS 'Secure storage for email configuration credentials and settings';
COMMENT ON TABLE email_processing_logs IS 'Audit log of all email processing attempts and results';