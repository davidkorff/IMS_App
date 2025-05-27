-- Fix existing email address format to use plus addressing
-- This updates "documents-origintest@42consultingllc.com" to "documents+origintest@42consultingllc.com"

-- First, let's see the current configuration
SELECT 
    id,
    instance_id,
    email_address,
    email_prefix,
    config_type
FROM email_configurations 
WHERE instance_id = 1;

-- Update the specific email address
UPDATE email_configurations 
SET email_address = 'documents+origintest@42consultingllc.com',
    email_prefix = 'origintest'
WHERE email_address = 'documents-origintest@42consultingllc.com';

-- Verify the change
SELECT 
    id,
    instance_id,
    email_address,
    email_prefix,
    config_type
FROM email_configurations 
WHERE instance_id = 1;