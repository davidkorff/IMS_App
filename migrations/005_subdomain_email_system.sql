-- Migration: Add subdomain-based email system
-- This allows each instance to have a subdomain and multiple email prefixes

-- Add subdomain to instances table
ALTER TABLE ims_instances 
ADD COLUMN IF NOT EXISTS email_subdomain VARCHAR(100) UNIQUE;

-- Add constraint to ensure subdomain is lowercase and valid format
ALTER TABLE ims_instances 
ADD CONSTRAINT chk_email_subdomain_format 
CHECK (email_subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

-- Add email prefix to configurations table
ALTER TABLE email_configurations 
ADD COLUMN IF NOT EXISTS email_prefix VARCHAR(100);

-- Add constraint to ensure prefix is valid email format
ALTER TABLE email_configurations 
ADD CONSTRAINT chk_email_prefix_format 
CHECK (email_prefix ~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$');

-- Create unique constraint for subdomain + prefix combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_subdomain_prefix 
ON email_configurations(instance_id, email_prefix) 
WHERE email_prefix IS NOT NULL;

-- Create table for reserved subdomains
CREATE TABLE IF NOT EXISTS reserved_subdomains (
    subdomain VARCHAR(100) PRIMARY KEY,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert common reserved subdomains
INSERT INTO reserved_subdomains (subdomain, reason) VALUES 
    ('www', 'Reserved for website'),
    ('mail', 'Reserved for mail server'),
    ('admin', 'Reserved for administration'),
    ('api', 'Reserved for API'),
    ('app', 'Reserved for application'),
    ('ftp', 'Reserved for FTP'),
    ('email', 'Reserved for email system'),
    ('smtp', 'Reserved for SMTP'),
    ('imap', 'Reserved for IMAP'),
    ('pop', 'Reserved for POP3'),
    ('test', 'Reserved for testing'),
    ('demo', 'Reserved for demos'),
    ('staging', 'Reserved for staging'),
    ('dev', 'Reserved for development')
ON CONFLICT DO NOTHING;

-- Add helper function to generate subdomain from instance name
CREATE OR REPLACE FUNCTION generate_subdomain(instance_name TEXT) 
RETURNS TEXT AS $$
BEGIN
    -- Convert to lowercase, replace spaces with hyphens, remove special chars
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(instance_name, '[^a-zA-Z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Add column to track if using subdomain system or legacy email
ALTER TABLE email_configurations 
ADD COLUMN IF NOT EXISTS email_system_type VARCHAR(20) DEFAULT 'legacy'
CHECK (email_system_type IN ('legacy', 'subdomain'));

-- Update existing configurations to mark them as legacy
UPDATE email_configurations 
SET email_system_type = 'legacy' 
WHERE email_system_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN ims_instances.email_subdomain IS 'Unique subdomain for this instance (e.g., "origintest" for origintest.42consultingllc.com)';
COMMENT ON COLUMN email_configurations.email_prefix IS 'Email prefix for subdomain system (e.g., "docs" for docs@subdomain.42consultingllc.com)';
COMMENT ON COLUMN email_configurations.email_system_type IS 'Type of email system: legacy (full email) or subdomain (prefix-based)';

-- Create system config table for tracking catch-all processing
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger to update timestamp
CREATE OR REPLACE FUNCTION update_system_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_config_timestamp_trigger
BEFORE UPDATE ON system_config
FOR EACH ROW
EXECUTE FUNCTION update_system_config_timestamp();