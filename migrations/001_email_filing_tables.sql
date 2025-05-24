-- Email Filing System Database Migration
-- Creates tables for email filing functionality

-- Email filing configurations per user/instance
CREATE TABLE IF NOT EXISTS email_filing_configs (
    config_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    instance_id INTEGER NOT NULL REFERENCES ims_instances(instance_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL UNIQUE,
    default_folder_id INTEGER,
    auto_extract_control_numbers BOOLEAN DEFAULT true,
    control_number_patterns TEXT DEFAULT '\\b[A-Z]{2,4}[0-9]{6,10}\\b',
    file_email_as_pdf BOOLEAN DEFAULT true,
    include_attachments BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, instance_id, name)
);

-- Email filing activity logs for audit trail
CREATE TABLE IF NOT EXISTS email_filing_logs (
    log_id SERIAL PRIMARY KEY,
    config_id INTEGER REFERENCES email_filing_configs(config_id) ON DELETE SET NULL,
    instance_id INTEGER REFERENCES ims_instances(instance_id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Email metadata
    email_subject VARCHAR(500),
    email_from VARCHAR(255),
    email_to VARCHAR(255),
    email_date TIMESTAMP WITH TIME ZONE,
    email_message_id VARCHAR(255),
    
    -- Processing details
    control_numbers_found TEXT[], -- Array of control numbers found
    control_number_used VARCHAR(50), -- The one actually used for filing
    policy_guid VARCHAR(50),
    quote_guid VARCHAR(50),
    document_guid VARCHAR(50),
    folder_id INTEGER,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'error', 'skipped'
    error_message TEXT,
    processing_attempts INTEGER DEFAULT 0,
    
    -- Email content (for debugging/reprocessing)
    email_body_text TEXT,
    email_body_html TEXT,
    attachments_count INTEGER DEFAULT 0,
    
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retry_after TIMESTAMP WITH TIME ZONE
);

-- Email attachments tracking
CREATE TABLE IF NOT EXISTS email_filing_attachments (
    attachment_id SERIAL PRIMARY KEY,
    log_id INTEGER NOT NULL REFERENCES email_filing_logs(log_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    file_size INTEGER,
    document_guid VARCHAR(50), -- IMS document GUID if filed separately
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'success', 'error', 'skipped'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update trigger for email_filing_configs
CREATE OR REPLACE FUNCTION update_email_filing_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_filing_configs_updated_at
    BEFORE UPDATE ON email_filing_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_email_filing_configs_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_config ON email_filing_logs (config_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_status ON email_filing_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_control_number ON email_filing_logs (control_number_used);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_processed_at ON email_filing_logs (processed_at);
CREATE INDEX IF NOT EXISTS idx_attachments_log_id ON email_filing_attachments (log_id);

-- Insert default control number patterns for common formats
COMMENT ON COLUMN email_filing_configs.control_number_patterns IS 'Regex patterns for extracting control numbers from email content, one per line';
COMMENT ON COLUMN email_filing_logs.control_numbers_found IS 'All control numbers found in the email';
COMMENT ON COLUMN email_filing_logs.control_number_used IS 'The control number that was actually used for filing';

-- Grant permissions (adjust based on your database user setup)
-- GRANT ALL PRIVILEGES ON email_filing_configs TO your_app_user;
-- GRANT ALL PRIVILEGES ON email_filing_logs TO your_app_user;
-- GRANT ALL PRIVILEGES ON email_filing_attachments TO your_app_user;