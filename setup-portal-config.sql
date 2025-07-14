-- Insert or update portal configuration
INSERT INTO producer_portal_config (
    instance_id, 
    portal_subdomain, 
    portal_name, 
    is_active, 
    enable_self_registration,
    primary_color,
    company_name
) VALUES (
    4, 
    'isc', 
    'ISC Insurance Portal', 
    true, 
    true,
    '#0066cc',
    'ISC Insurance'
) ON CONFLICT (instance_id) DO UPDATE SET
    portal_subdomain = 'isc',
    portal_name = 'ISC Insurance Portal',
    is_active = true,
    enable_self_registration = true;

-- Grant the producer access to LOBs
INSERT INTO producer_lob_access (producer_id, lob_id, granted_by)
SELECT 1, lob_id, 1
FROM portal_lines_of_business
WHERE instance_id = 4 AND is_active = true
ON CONFLICT DO NOTHING;

-- Check the results
SELECT * FROM producer_portal_config WHERE instance_id = 4;
SELECT * FROM producer_lob_access WHERE producer_id = 1;