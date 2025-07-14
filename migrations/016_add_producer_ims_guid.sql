-- Add IMS contact GUID to producers table
ALTER TABLE producers 
ADD COLUMN producer_guid UUID,
ADD COLUMN ims_contact_guid UUID,
ADD COLUMN ims_producer_location_guid UUID;

-- Add comments for clarity
COMMENT ON COLUMN producers.producer_guid IS 'Internal producer GUID for IMS integration';
COMMENT ON COLUMN producers.ims_contact_guid IS 'IMS ProducerContact GUID - must be linked by admin';
COMMENT ON COLUMN producers.ims_producer_location_guid IS 'IMS ProducerLocation GUID - optional';

-- Create index for faster lookups
CREATE INDEX idx_producers_ims_contact ON producers(ims_contact_guid);
CREATE INDEX idx_producers_email ON producers(email);

-- Add a view for easier producer management
CREATE VIEW producer_ims_status AS
SELECT 
    p.producer_id,
    p.email,
    p.first_name,
    p.last_name,
    p.agency_name,
    p.status,
    p.ims_contact_guid,
    p.ims_producer_location_guid,
    CASE 
        WHEN p.ims_contact_guid IS NOT NULL THEN 'Linked'
        ELSE 'Not Linked'
    END as ims_link_status,
    i.name as instance_name
FROM producers p
JOIN ims_instances i ON p.instance_id = i.instance_id;