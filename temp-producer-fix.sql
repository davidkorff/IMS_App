-- Check what producer GUIDs we have
SELECT 
    producer_id,
    email,
    first_name,
    last_name,
    ims_producer_guid,
    ims_producer_contact_guid,
    ims_producer_location_guid
FROM producers
WHERE instance_id = 4;

-- To temporarily fix by clearing MOCK values (use company GUID instead)
-- UPDATE producers 
-- SET 
--     ims_producer_guid = NULL,
--     ims_producer_contact_guid = NULL,
--     ims_producer_location_guid = NULL
-- WHERE instance_id = 4 
-- AND (ims_producer_guid LIKE 'MOCK%' 
--      OR ims_producer_contact_guid LIKE 'MOCK%'
--      OR ims_producer_location_guid LIKE 'MOCK%');