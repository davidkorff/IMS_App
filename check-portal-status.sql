-- Check the current status of instance 13 and its portal configuration

-- 1. Show what the subdomain router is looking for
SELECT 
    i.instance_id, 
    i.custom_domain as subdomain, 
    ppc.is_active 
FROM ims_instances i
LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
WHERE i.custom_domain = 'isc' 
  AND i.is_custom_domain_approved = true
  AND (ppc.is_active = true OR ppc.is_active IS NULL);

-- 2. Show the actual data for instance 13
SELECT 
    i.instance_id,
    i.name,
    i.custom_domain,
    i.is_custom_domain_approved,
    ppc.config_id,
    ppc.portal_name,
    ppc.is_active as portal_is_active,
    CASE 
        WHEN ppc.config_id IS NULL THEN 'No portal config exists'
        WHEN ppc.is_active IS NULL THEN 'Portal config exists but is_active is NULL'
        WHEN ppc.is_active = false THEN 'Portal config exists but is_active is false'
        WHEN ppc.is_active = true THEN 'Portal is active'
    END as status
FROM ims_instances i
LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
WHERE i.instance_id = 13;

-- 3. Show all instances with custom domains
SELECT 
    i.instance_id,
    i.name,
    i.custom_domain,
    i.is_custom_domain_approved,
    ppc.is_active as portal_active
FROM ims_instances i
LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
WHERE i.custom_domain IS NOT NULL
ORDER BY i.instance_id;