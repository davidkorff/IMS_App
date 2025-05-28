-- Check current email system schema and data

-- 1. Show ims_instances structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ims_instances'
AND column_name IN ('instance_id', 'name', 'email_subdomain', 'email_status')
ORDER BY ordinal_position;

-- 2. Show email_configurations structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'email_configurations'
AND column_name IN ('id', 'instance_id', 'email_address', 'email_prefix', 'email_system_type', 'config_type')
ORDER BY ordinal_position;

-- 3. Check constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid IN ('ims_instances'::regclass, 'email_configurations'::regclass)
AND conname LIKE '%email%' OR conname LIKE '%subdomain%';

-- 4. Show current data
SELECT 
    ii.instance_id,
    ii.name,
    ii.email_subdomain,
    COUNT(ec.id) as email_configs,
    STRING_AGG(ec.email_address, ', ') as configured_emails
FROM ims_instances ii
LEFT JOIN email_configurations ec ON ii.instance_id = ec.instance_id
GROUP BY ii.instance_id, ii.name, ii.email_subdomain
ORDER BY ii.name;

-- 5. Check for issues
SELECT 
    'Missing unique identifier' as issue,
    COUNT(*) as count
FROM ims_instances
WHERE email_subdomain IS NULL
UNION ALL
SELECT 
    'Invalid email format' as issue,
    COUNT(*) as count
FROM email_configurations
WHERE config_type = 'managed'
AND email_address NOT LIKE '%-%@42ims.com'
UNION ALL
SELECT 
    'Duplicate email addresses' as issue,
    COUNT(*) as count
FROM (
    SELECT email_address
    FROM email_configurations
    GROUP BY email_address
    HAVING COUNT(*) > 1
) dup;