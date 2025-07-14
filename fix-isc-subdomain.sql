-- Fix ISC subdomain configuration for instance 13
-- This will enable isc.42ims.com to work properly

-- First, check current configuration
SELECT 
    instance_id,
    name,
    custom_domain,
    is_custom_domain_approved
FROM ims_instances
WHERE instance_id = 13;

-- Update the ims_instances table to set the subdomain
UPDATE ims_instances 
SET custom_domain = 'isc', 
    is_custom_domain_approved = true 
WHERE instance_id = 13;

-- Verify the fix - this query should return results
SELECT 
    instance_id, 
    name,
    custom_domain as subdomain, 
    is_custom_domain_approved
FROM ims_instances
WHERE custom_domain = 'isc' 
  AND is_custom_domain_approved = true;

-- Check all producer portal URLs for instance 13
SELECT 
    instance_id,
    name,
    'https://' || custom_domain || '.42ims.com/producer-register' as subdomain_url,
    'https://42ims.com/instance/' || instance_id || '/producer-register' as direct_url,
    'https://42ims.com/instance/' || instance_id || '/producer-admin' as admin_url
FROM ims_instances
WHERE instance_id = 13;