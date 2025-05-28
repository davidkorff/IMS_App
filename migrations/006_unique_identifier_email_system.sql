-- Migration: Update email system to use unique identifiers
-- Format: prefix-uniqueidentifier@42ims.com (e.g., docs-isctest@42ims.com)

-- 1. Ensure email_subdomain is being used as unique identifier
-- (It already has UNIQUE constraint and format validation)
ALTER TABLE ims_instances 
ALTER COLUMN email_subdomain SET NOT NULL;

-- Update the column comment to reflect new usage
COMMENT ON COLUMN ims_instances.email_subdomain IS 'Unique email identifier for this instance (e.g., "isctest"). Required for email routing. Used in format: prefix-identifier@42ims.com';

-- 2. Add unique constraint on email_address to prevent duplicates
ALTER TABLE email_configurations 
DROP CONSTRAINT IF EXISTS unique_email_address;

ALTER TABLE email_configurations 
ADD CONSTRAINT unique_email_address UNIQUE (email_address);

-- 3. Update email_system_type to reflect new system
ALTER TABLE email_configurations
ADD COLUMN IF NOT EXISTS email_system_type_new VARCHAR(20) DEFAULT 'unique_identifier';

UPDATE email_configurations 
SET email_system_type_new = 'unique_identifier'
WHERE email_system_type = 'subdomain';

-- 4. Migration script to update existing email addresses to new format
-- This converts plus addresses to identifier format
UPDATE email_configurations ec
SET email_address = 
    CASE 
        -- Convert plus addressing to new format
        WHEN email_address LIKE 'documents+%@%.com' THEN
            REPLACE(
                REPLACE(email_address, 'documents+', ''), 
                '@42consultingllc.com', 
                ''
            ) || '-' || ii.email_subdomain || '@42ims.com'
        -- Convert subdomain format to new format  
        WHEN email_system_type = 'subdomain' THEN
            email_prefix || '-' || ii.email_subdomain || '@42ims.com'
        ELSE email_address
    END
FROM ims_instances ii
WHERE ec.instance_id = ii.instance_id
AND ii.email_subdomain IS NOT NULL
AND (
    email_address LIKE 'documents+%@42consultingllc.com' 
    OR email_system_type = 'subdomain'
);

-- 5. Update all configs to use new system type
UPDATE email_configurations
SET email_system_type = 'unique_identifier'
WHERE config_type = 'managed';

-- 6. Show migration results
SELECT 
    ec.id,
    ii.name as instance_name,
    ii.email_subdomain as unique_identifier,
    ec.email_prefix,
    ec.email_address,
    ec.email_system_type
FROM email_configurations ec
JOIN ims_instances ii ON ec.instance_id = ii.instance_id
ORDER BY ii.name, ec.email_prefix;

-- 7. Add validation function for email format
CREATE OR REPLACE FUNCTION validate_email_format()
RETURNS TRIGGER AS $$
BEGIN
    -- For managed emails, ensure format is correct
    IF NEW.config_type = 'managed' AND NEW.email_address NOT LIKE '%-%@42ims.com' THEN
        RAISE EXCEPTION 'Managed emails must use format: prefix-identifier@42ims.com';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Add trigger to validate email format on insert/update
DROP TRIGGER IF EXISTS validate_email_format_trigger ON email_configurations;
CREATE TRIGGER validate_email_format_trigger
BEFORE INSERT OR UPDATE ON email_configurations
FOR EACH ROW
EXECUTE FUNCTION validate_email_format();