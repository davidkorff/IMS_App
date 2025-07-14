-- Debug subdomain query
SELECT 
    i.instance_id, 
    i.custom_domain, 
    i.is_custom_domain_approved,
    ppc.is_active as portal_is_active
FROM ims_instances i
LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
WHERE i.instance_id = 4;

-- Check what the query is looking for
SELECT 
    i.instance_id, 
    i.custom_domain as subdomain, 
    ppc.is_active 
FROM ims_instances i
LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
WHERE i.custom_domain = 'isc' 
  AND i.is_custom_domain_approved = true
  AND (ppc.is_active = true OR ppc.is_active IS NULL);