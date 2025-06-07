-- Migration 007: Add custom domain support for CNAME-based email addresses
-- This supports email patterns like Docs@{cname}.42ims.com

-- Add custom_domain column to ims_instances table
ALTER TABLE ims_instances 
ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(100);

-- Add unique constraint for custom_domain (admin-assigned, can be reused across instances)
-- Note: We don't add UNIQUE constraint here since the same CNAME can be assigned to multiple instances
-- Instead, we'll enforce uniqueness at the email+domain combination level

-- Add constraint to ensure custom_domain follows CNAME format (if provided)
ALTER TABLE ims_instances 
ADD CONSTRAINT chk_custom_domain_format 
CHECK (
    custom_domain IS NULL OR 
    custom_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ims_instances_custom_domain 
ON ims_instances(custom_domain) 
WHERE custom_domain IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN ims_instances.custom_domain IS 'Custom CNAME subdomain for email addresses (e.g., "isc" for emails like Docs@isc.42ims.com). Admin-assigned and manually configured in Cloudflare.';