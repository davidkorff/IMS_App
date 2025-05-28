-- Update column comment to reflect new usage
COMMENT ON COLUMN ims_instances.email_subdomain IS 'Unique email identifier for this instance (e.g., "isctest"). Used in email addresses like docs-isctest@42ims.com';

-- You might also want to rename the column for clarity (optional)
-- ALTER TABLE ims_instances RENAME COLUMN email_subdomain TO email_identifier;

-- Show current unique identifiers
SELECT 
    instance_id,
    name,
    email_subdomain as email_identifier,
    email_status
FROM ims_instances
ORDER BY name;