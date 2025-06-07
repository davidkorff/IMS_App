-- Migration script to sync local database with production schema
-- Run this on your local PostgreSQL database

-- Add missing columns to ims_instances table
ALTER TABLE ims_instances 
ADD COLUMN IF NOT EXISTS email_config jsonb,
ADD COLUMN IF NOT EXISTS email_status character varying(20) DEFAULT 'not_configured';

-- Update email_subdomain to be NOT NULL (match production)
-- First, update any NULL values to a default
UPDATE ims_instances SET email_subdomain = 'default' WHERE email_subdomain IS NULL;
-- Then make it NOT NULL
ALTER TABLE ims_instances ALTER COLUMN email_subdomain SET NOT NULL;

-- Verify the changes
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'ims_instances'
ORDER BY 
    ordinal_position;