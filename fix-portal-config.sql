-- Check current portal config
SELECT * FROM producer_portal_config WHERE instance_id = 4;

-- If no record exists, insert one
INSERT INTO producer_portal_config (instance_id, is_active, portal_name, company_name, enable_self_registration)
VALUES (4, true, 'ISC Portal', 'ISC Insurance', true)
ON CONFLICT (instance_id) DO UPDATE
SET is_active = true;

-- Verify the fix
SELECT 
    i.instance_id, 
    i.custom_domain,
    i.is_custom_domain_approved,
    ppc.is_active 
FROM ims_instances i
LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
WHERE i.custom_domain = 'isc';