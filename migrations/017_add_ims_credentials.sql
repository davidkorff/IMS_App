-- Add IMS API credentials to ims_instances table
-- These credentials are used to authenticate with IMS web services

ALTER TABLE ims_instances
ADD COLUMN IF NOT EXISTS ims_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS ims_context VARCHAR(255),
ADD COLUMN IF NOT EXISTS ims_base_url VARCHAR(500);

-- Add comments
COMMENT ON COLUMN ims_instances.ims_token IS 'IMS API authentication token (GUID)';
COMMENT ON COLUMN ims_instances.ims_context IS 'IMS API context identifier';
COMMENT ON COLUMN ims_instances.ims_base_url IS 'IMS web services base URL (e.g., https://ws2.mgasystems.com/ims_origintest)';

-- Update the existing instance with default values if needed
UPDATE ims_instances 
SET ims_base_url = 'https://ws2.mgasystems.com/ims_origintest'
WHERE ims_base_url IS NULL;