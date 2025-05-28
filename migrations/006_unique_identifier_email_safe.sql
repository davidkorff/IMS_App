-- Safe Migration: Implement unique identifier email system
-- This migration preserves existing data while enabling the new format

-- 1. First, let's check current state
SELECT 
    COUNT(*) as total_instances,
    COUNT(email_subdomain) as with_subdomain,
    COUNT(*) - COUNT(email_subdomain) as missing_subdomain
FROM ims_instances;

-- 2. Check for any duplicate subdomains (there shouldn't be any due to UNIQUE constraint)
SELECT email_subdomain, COUNT(*) 
FROM ims_instances 
WHERE email_subdomain IS NOT NULL 
GROUP BY email_subdomain 
HAVING COUNT(*) > 1;

-- 3. For instances without email_subdomain, generate one from instance name
UPDATE ims_instances 
SET email_subdomain = LOWER(
    SUBSTRING(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),  -- Remove special chars
                '\s+', '-', 'g'  -- Replace spaces with hyphens
            ),
            '^-+|-+$', '', 'g'  -- Remove leading/trailing hyphens
        ),
        1, 20  -- Limit to 20 chars
    ) || '-' || instance_id  -- Add instance ID to ensure uniqueness
)
WHERE email_subdomain IS NULL;

-- 4. Ensure email_subdomain follows the required format
UPDATE ims_instances
SET email_subdomain = REGEXP_REPLACE(email_subdomain, '[^a-z0-9-]', '-', 'g')
WHERE email_subdomain !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$';

-- 5. Now we can safely make it NOT NULL
ALTER TABLE ims_instances 
ALTER COLUMN email_subdomain SET NOT NULL;

-- 6. Update column documentation
COMMENT ON COLUMN ims_instances.email_subdomain IS 'Unique email identifier (e.g., "isctest"). Used in emails like docs-isctest@42ims.com. Must be unique across all instances.';

-- 7. Add constraint on email_address uniqueness if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_email_address'
    ) THEN
        ALTER TABLE email_configurations 
        ADD CONSTRAINT unique_email_address UNIQUE (email_address);
    END IF;
END $$;

-- 8. Create a view to help manage email configurations
CREATE OR REPLACE VIEW email_config_overview AS
SELECT 
    ii.instance_id,
    ii.name as instance_name,
    ii.email_subdomain as unique_identifier,
    ec.id as config_id,
    ec.email_prefix,
    ec.email_address,
    ec.config_type,
    ec.email_system_type,
    CASE 
        WHEN ec.email_address LIKE '%-' || ii.email_subdomain || '@42ims.com' THEN 'Valid Format'
        ELSE 'Needs Update'
    END as format_status
FROM ims_instances ii
LEFT JOIN email_configurations ec ON ii.instance_id = ec.instance_id
ORDER BY ii.name, ec.email_prefix;

-- 9. Show current state
SELECT * FROM email_config_overview;

-- 10. Helper function to generate email address
CREATE OR REPLACE FUNCTION generate_email_address(
    p_prefix VARCHAR,
    p_identifier VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
    RETURN LOWER(p_prefix || '-' || p_identifier || '@42ims.com');
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT generate_email_address('docs', 'isctest');  -- Returns: docs-isctest@42ims.com