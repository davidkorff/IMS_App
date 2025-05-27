-- Update email address from old format to plus addressing format
-- For instance_id = 1, config_id = 1

-- First, let's see the current configuration
SELECT 
    id,
    instance_id,
    email_address,
    email_prefix,
    config_type
FROM email_configurations 
WHERE instance_id = 1 AND id = 1;

-- Update the email address to use plus addressing format
UPDATE email_configurations 
SET email_address = 'documents+origintest-docs@42consultingllc.com'
WHERE instance_id = 1 
AND id = 1
AND email_address = 'documents-origintest@42consultingllc.com';

-- If you need to update multiple configurations, you can use this pattern:
-- This will update all managed email configurations to use plus addressing
UPDATE email_configurations 
SET email_address = CONCAT('documents+', 
    (SELECT email_subdomain FROM ims_instances WHERE instance_id = email_configurations.instance_id),
    '-',
    COALESCE(email_prefix, 'docs'),
    '@42consultingllc.com'
)
WHERE config_type = 'managed'
AND email_address LIKE '%@42consultingllc.com'
AND email_address NOT LIKE 'documents+%';

-- Verify the changes
SELECT 
    ec.id,
    ec.instance_id,
    ii.name as instance_name,
    ii.email_subdomain,
    ec.email_prefix,
    ec.email_address,
    ec.config_type
FROM email_configurations ec
JOIN ims_instances ii ON ec.instance_id = ii.instance_id
WHERE ec.instance_id = 1;