-- Migration: Add custom_js column to producer_portal_config table
-- Purpose: Allow instances to add custom JavaScript code that runs on page load
-- Date: 2025-01-09

-- Add custom_js column to producer_portal_config table
ALTER TABLE producer_portal_config 
ADD COLUMN IF NOT EXISTS custom_js TEXT;

-- Add comment for documentation
COMMENT ON COLUMN producer_portal_config.custom_js IS 'Custom JavaScript code to be executed on page load in the producer portal';

-- Update the updated_at timestamp for existing records
UPDATE producer_portal_config 
SET updated_at = CURRENT_TIMESTAMP 
WHERE custom_js IS NULL;