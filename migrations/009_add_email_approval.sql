-- Migration 009: Add individual email approval for subdomain-based emails
-- This allows users to request subdomain emails that require individual admin approval

-- Add approval column to email_configurations table
ALTER TABLE email_configurations 
ADD COLUMN IF NOT EXISTS is_email_approved BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN email_configurations.is_email_approved IS 'Admin approval status for individual email address. When FALSE, email is created but may use fallback format. When TRUE, exact email format is available.';

-- For existing configurations, approve them by default
UPDATE email_configurations 
SET is_email_approved = TRUE;