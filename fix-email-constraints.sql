-- Fix email configuration constraints to allow multiple configs per instance

-- Step 1: Drop the unique constraint that limits one config per instance
ALTER TABLE email_configurations 
DROP CONSTRAINT IF EXISTS email_configurations_instance_id_key;

-- Step 2: Add a composite unique constraint to prevent duplicate email addresses
-- but allow multiple different configs per instance
ALTER TABLE email_configurations 
ADD CONSTRAINT email_configurations_email_address_unique 
UNIQUE (email_address);

-- Step 3: Add a composite unique constraint for instance_id + email_prefix
-- This prevents duplicate prefixes within the same instance
ALTER TABLE email_configurations 
ADD CONSTRAINT email_configurations_instance_prefix_unique 
UNIQUE (instance_id, email_prefix);

-- Verify the changes
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'email_configurations'
AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.constraint_name;