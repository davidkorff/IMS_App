-- The columns already exist with slightly different names
-- Just create the indexes and view

-- Create indexes for faster lookups if they don't exist
CREATE INDEX IF NOT EXISTS idx_producers_ims_contact ON producers(ims_producer_contact_guid);
CREATE INDEX IF NOT EXISTS idx_producers_email ON producers(email);

-- Create or replace the view with correct column names
CREATE OR REPLACE VIEW producer_ims_status AS
SELECT 
    p.producer_id,
    p.email,
    p.first_name,
    p.last_name,
    p.agency_name,
    p.status,
    p.ims_producer_contact_guid,
    p.ims_producer_location_guid,
    CASE 
        WHEN p.ims_producer_contact_guid IS NOT NULL 
         AND p.ims_producer_contact_guid NOT LIKE 'MOCK%' THEN 'Linked'
        ELSE 'Not Linked'
    END as ims_link_status,
    i.name as instance_name
FROM producers p
JOIN ims_instances i ON p.instance_id = i.instance_id;