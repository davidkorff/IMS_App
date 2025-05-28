-- Migration script to switch from plus addressing to subdomain email system

-- 1. First, let's see current email configurations
SELECT 
    ec.id,
    ec.instance_id,
    ii.name as instance_name,
    ii.email_subdomain,
    ec.email_address as current_email,
    ec.email_prefix,
    ec.email_system_type,
    CASE 
        WHEN ec.email_prefix IS NOT NULL AND ii.email_subdomain IS NOT NULL 
        THEN ec.email_prefix || '@' || ii.email_subdomain || '.42consultingllc.com'
        ELSE 'Needs subdomain configuration'
    END as new_subdomain_email
FROM email_configurations ec
JOIN ims_instances ii ON ec.instance_id = ii.instance_id
ORDER BY ii.name;

-- 2. Update email configurations to use subdomain format
-- This will convert plus addresses to subdomain format
UPDATE email_configurations ec
SET 
    email_address = ec.email_prefix || '@' || ii.email_subdomain || '.42consultingllc.com',
    email_system_type = 'subdomain'
FROM ims_instances ii
WHERE ec.instance_id = ii.instance_id
    AND ii.email_subdomain IS NOT NULL
    AND ec.email_prefix IS NOT NULL
    AND ec.email_system_type != 'subdomain';

-- 3. For configurations without email_prefix, extract from plus address
UPDATE email_configurations ec
SET 
    email_prefix = CASE
        WHEN email_address LIKE 'documents+%@42consultingllc.com' 
        THEN REPLACE(REPLACE(email_address, 'documents+', ''), '@42consultingllc.com', '')
        ELSE NULL
    END
WHERE email_prefix IS NULL
    AND email_address LIKE 'documents+%@42consultingllc.com';

-- 4. Show results after migration
SELECT 
    ec.id,
    ii.name as instance_name,
    ec.email_address,
    ec.email_prefix,
    ii.email_subdomain,
    ec.email_system_type
FROM email_configurations ec
JOIN ims_instances ii ON ec.instance_id = ii.instance_id
ORDER BY ii.name;

-- 5. Ensure system_config table exists for catch-all processing
INSERT INTO system_config (key, value) 
VALUES ('catch_all_last_processed', '2025-01-01T00:00:00Z')
ON CONFLICT (key) DO NOTHING;