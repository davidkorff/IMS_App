-- PRODUCTION MIGRATION SCRIPT
-- Based on analysis of your production database

-- Step 1: First, let's set email_subdomain for Origin_Test
-- Using 'origintest' to match the existing email_prefix
UPDATE ims_instances 
SET email_subdomain = 'origintest'
WHERE instance_id = 1 AND name = 'Origin_Test';

-- Verify the update
SELECT instance_id, name, email_subdomain, email_status 
FROM ims_instances ORDER BY instance_id;

-- Step 2: Update email_status for ISCTest (currently 'not_configured' but has subdomain)
UPDATE ims_instances 
SET email_status = 'active'
WHERE instance_id = 3 AND name = 'ISCTest';

-- Step 3: Update the existing email configuration to new format
-- Change from 'documents+origintest@42consultingllc.com' to 'docs-origintest@42ims.com'
UPDATE email_configurations 
SET email_address = 'docs-origintest@42ims.com'
WHERE id = 1 AND instance_id = 1;

-- Step 4: Add unique constraint on email_address (if not exists)
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

-- Step 5: Make email_subdomain required for future instances
-- First check if any NULL values exist (should be none after step 1)
SELECT COUNT(*) as null_count FROM ims_instances WHERE email_subdomain IS NULL;

-- If the above returns 0, then run:
ALTER TABLE ims_instances 
ALTER COLUMN email_subdomain SET NOT NULL;

-- Step 6: Create a helper view to see all email configurations
CREATE OR REPLACE VIEW email_config_summary AS
SELECT 
    ii.instance_id,
    ii.name as instance_name,
    ii.email_subdomain as unique_identifier,
    ec.id as config_id,
    ec.email_prefix,
    ec.email_address,
    ec.config_type,
    ec.email_system_type,
    ec.test_status
FROM ims_instances ii
LEFT JOIN email_configurations ec ON ii.instance_id = ec.instance_id
ORDER BY ii.name, ec.email_prefix;

-- Step 7: Final verification - show the results
SELECT * FROM email_config_summary;

-- Expected result after migration:
-- Origin_Test should have:
--   - email_subdomain: 'origintest'
--   - email config with address: 'docs-origintest@42ims.com'
-- ISCTest should have:
--   - email_subdomain: 'isctest'
--   - No email configs yet (ready to create)