-- Check portal configuration
SELECT 
    ppc.*,
    i.instance_name,
    i.subdomain as instance_subdomain
FROM producer_portal_config ppc
JOIN ims_instances i ON ppc.instance_id = i.instance_id
WHERE ppc.instance_id = 4;

-- Check if any producers exist
SELECT * FROM producers WHERE instance_id = 4;

-- Check lines of business
SELECT lob_id, line_name, line_code, is_active, ims_rating_type_name, rater_file_name
FROM portal_lines_of_business 
WHERE instance_id = 4;

-- Check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%producer%' OR table_name LIKE '%portal%'
ORDER BY table_name;