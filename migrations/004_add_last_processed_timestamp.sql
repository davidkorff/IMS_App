-- Migration: Add last_processed_timestamp to track which emails have been processed
-- This prevents reprocessing the same emails every 5 minutes

-- Add last_processed_timestamp column to email_configurations table
ALTER TABLE email_configurations 
ADD COLUMN IF NOT EXISTS last_processed_timestamp TIMESTAMP DEFAULT '2024-01-01 00:00:00';

-- Create index for better performance when querying by timestamp
CREATE INDEX IF NOT EXISTS idx_email_config_last_processed 
ON email_configurations(last_processed_timestamp);

-- Update existing configurations to start processing from current time
-- This prevents processing old emails
UPDATE email_configurations 
SET last_processed_timestamp = CURRENT_TIMESTAMP 
WHERE last_processed_timestamp = '2024-01-01 00:00:00';

-- Add comment for documentation
COMMENT ON COLUMN email_configurations.last_processed_timestamp 
IS 'Timestamp of the last email processed to prevent reprocessing';