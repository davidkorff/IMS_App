-- Check portal configuration with correct column names
SELECT 
    instance_id,
    portal_subdomain,
    portal_name,
    is_active,
    enable_self_registration
FROM producer_portal_config 
WHERE instance_id = 4;

-- If empty, insert default config
-- INSERT INTO producer_portal_config (instance_id, portal_subdomain, portal_name, is_active, enable_self_registration)
-- VALUES (4, 'isc', 'ISC Portal', true, true);