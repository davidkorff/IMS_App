-- Fix legacy email_config JSONB field in instances table
-- This old field is showing in the logs and contains outdated email address

-- First, let's see what's in the email_config field
SELECT 
    instance_id, 
    name, 
    email_config,
    email_status
FROM ims_instances 
WHERE instance_id = 1;

-- Clear the old email_config JSONB field since we now use the email_configurations table
UPDATE ims_instances 
SET email_config = NULL
WHERE instance_id = 1;

-- Verify the change
SELECT 
    instance_id, 
    name, 
    email_config,
    email_status
FROM ims_instances 
WHERE instance_id = 1;