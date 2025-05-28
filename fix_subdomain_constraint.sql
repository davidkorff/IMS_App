-- Fix subdomain constraint to allow NULL values
-- This allows instances to be created without requiring a subdomain

-- Drop the existing constraint
ALTER TABLE ims_instances 
DROP CONSTRAINT IF EXISTS chk_email_subdomain_format;

-- Add the constraint back but only check non-NULL values
ALTER TABLE ims_instances 
ADD CONSTRAINT chk_email_subdomain_format 
CHECK (email_subdomain IS NULL OR email_subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

-- Verify the change
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'ims_instances'::regclass
AND conname = 'chk_email_subdomain_format';