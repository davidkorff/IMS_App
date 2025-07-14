-- Fix producer_portal_config table to add unique constraint on instance_id

-- First, check if constraint already exists
SELECT conname 
FROM pg_constraint 
WHERE conrelid = 'producer_portal_config'::regclass 
AND contype = 'u';

-- Add unique constraint on instance_id if it doesn't exist
ALTER TABLE producer_portal_config 
ADD CONSTRAINT unique_instance_config UNIQUE (instance_id);

-- Now insert/update the config for instance 13
INSERT INTO producer_portal_config (
    instance_id, 
    portal_name, 
    is_active,
    welcome_message,
    primary_color
) VALUES (
    13, 
    'ISC Producer Portal', 
    true,
    'Welcome to the ISC Producer Portal',
    '#0066cc'
)
ON CONFLICT (instance_id) 
DO UPDATE SET 
    is_active = true,
    portal_name = 'ISC Producer Portal';

-- Verify the configuration
SELECT 
    i.instance_id,
    i.name,
    i.custom_domain,
    i.is_custom_domain_approved,
    ppc.is_active as portal_active,
    ppc.portal_name
FROM ims_instances i
LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
WHERE i.instance_id = 13;