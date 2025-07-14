-- Check columns in producer_portal_config table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'producer_portal_config'
ORDER BY ordinal_position;

-- Check portal config for instance 4
SELECT * FROM producer_portal_config WHERE instance_id = 4;

-- Check instance configuration
SELECT instance_id, name, custom_domain, is_custom_domain_approved 
FROM ims_instances 
WHERE instance_id = 4;