-- Migration 008: Add approval field for custom domains
-- This allows users to enter CNAMEs that require admin approval before use

-- Add approval column to ims_instances table
ALTER TABLE ims_instances 
ADD COLUMN IF NOT EXISTS is_custom_domain_approved BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN ims_instances.is_custom_domain_approved IS 'Admin approval status for custom domain. When FALSE, only hyphen format (docs-cname@42ims.com) is available. When TRUE, CNAME format (docs@cname.42ims.com) is also available.';

-- Update existing instances to approved (assuming current ones are already approved)
UPDATE ims_instances 
SET is_custom_domain_approved = TRUE 
WHERE custom_domain IS NOT NULL;