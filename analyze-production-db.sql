-- PRODUCTION DATABASE ANALYSIS QUERIES
-- Run these queries to understand current state

-- Query 1: Check ims_instances structure and data
SELECT 
    instance_id,
    name,
    email_subdomain,
    email_status,
    CASE 
        WHEN email_subdomain IS NULL THEN 'MISSING'
        WHEN email_subdomain = '' THEN 'EMPTY'
        ELSE 'SET'
    END as subdomain_status
FROM ims_instances
ORDER BY instance_id;

-- Query 2: Check email_configurations structure and data
SELECT 
    ec.id,
    ec.instance_id,
    ii.name as instance_name,
    ec.config_type,
    ec.email_address,
    ec.email_prefix,
    ec.email_system_type,
    ec.test_status
FROM email_configurations ec
JOIN ims_instances ii ON ec.instance_id = ii.instance_id
ORDER BY ec.instance_id, ec.id;

-- Query 3: Check for duplicate email addresses
SELECT 
    email_address,
    COUNT(*) as count,
    STRING_AGG(CAST(instance_id AS VARCHAR), ', ') as instance_ids
FROM email_configurations
GROUP BY email_address
HAVING COUNT(*) > 1;

-- Query 4: Check constraints on tables
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('ims_instances', 'email_configurations')
AND (kcu.column_name LIKE '%email%' OR kcu.column_name LIKE '%subdomain%' OR tc.constraint_name LIKE '%email%' OR tc.constraint_name LIKE '%subdomain%')
ORDER BY tc.table_name, tc.constraint_type;

-- Query 5: Count summary
SELECT 
    'Total Instances' as metric,
    COUNT(*) as count
FROM ims_instances
UNION ALL
SELECT 
    'Instances with email_subdomain' as metric,
    COUNT(*) as count
FROM ims_instances
WHERE email_subdomain IS NOT NULL AND email_subdomain != ''
UNION ALL
SELECT 
    'Total Email Configurations' as metric,
    COUNT(*) as count
FROM email_configurations
UNION ALL
SELECT 
    'Managed Email Configurations' as metric,
    COUNT(*) as count
FROM email_configurations
WHERE config_type = 'managed';

-- Query 6: Show what the new email format would look like
SELECT 
    ec.id,
    ii.name as instance_name,
    ii.email_subdomain,
    ec.email_prefix,
    ec.email_address as current_email,
    CASE 
        WHEN ii.email_subdomain IS NOT NULL AND ec.email_prefix IS NOT NULL THEN
            ec.email_prefix || '-' || ii.email_subdomain || '@42ims.com'
        ELSE 
            'NEEDS DATA'
    END as new_email_format
FROM email_configurations ec
JOIN ims_instances ii ON ec.instance_id = ii.instance_id
WHERE ec.config_type = 'managed'
ORDER BY ii.name, ec.email_prefix;