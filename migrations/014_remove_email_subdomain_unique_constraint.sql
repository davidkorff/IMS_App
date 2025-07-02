-- Remove unique constraint on email_subdomain to allow multiple instances to share the same subdomain

-- Drop the unique constraint on email_subdomain
ALTER TABLE ims_instances DROP CONSTRAINT IF EXISTS ims_instances_email_subdomain_key;

-- Verify the constraint is removed (optional - for logging purposes)
-- This will show remaining constraints on the table
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'ims_instances'::regclass;