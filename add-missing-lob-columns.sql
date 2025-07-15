-- Add missing columns to portal_lines_of_business table
-- This script adds columns that exist in test but are missing in production

-- Add ims_procedure_id column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_procedure_id INTEGER;

-- Add ims_procedure_name column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_procedure_name VARCHAR(255);

-- Add form_config column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS form_config TEXT;

-- Add form_schema_id column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS form_schema_id UUID;

-- Add ims_rating_type_id column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_rating_type_id INTEGER;

-- Add ims_rating_type_name column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_rating_type_name VARCHAR(255);

-- Add rater_file_name column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS rater_file_name VARCHAR(255);

-- Add rater_file_data column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS rater_file_data BYTEA;

-- Add rater_file_uploaded_at column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS rater_file_uploaded_at TIMESTAMP;

-- Add rater_file_content_type column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS rater_file_content_type VARCHAR(100);

-- Add ims_underwriter_guid column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_underwriter_guid UUID;

-- Add ims_producer_contact_guid column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_producer_contact_guid UUID;

-- Add ims_producer_location_guid column
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_producer_location_guid UUID;

-- Verify all columns exist
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns
WHERE table_name = 'portal_lines_of_business'
ORDER BY ordinal_position;