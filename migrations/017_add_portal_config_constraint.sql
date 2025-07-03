-- Add unique constraint to producer_portal_config for PostgreSQL ON CONFLICT
-- This ensures only one portal configuration per instance

-- For PostgreSQL
ALTER TABLE producer_portal_config 
ADD CONSTRAINT uq_producer_portal_config_instance_id UNIQUE (instance_id);