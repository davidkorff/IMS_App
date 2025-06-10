-- Add enhanced authentication features to custom webhooks
-- This migration adds auth_type, secret_key, and allowed_ips columns

-- Add new columns if they don't exist
ALTER TABLE custom_webhooks 
ADD COLUMN IF NOT EXISTS auth_type VARCHAR(50) DEFAULT 'bearer',
ADD COLUMN IF NOT EXISTS secret_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS allowed_ips TEXT[];

-- Update existing webhooks to have auth_type = 'bearer' if they have authentication enabled
UPDATE custom_webhooks 
SET auth_type = 'bearer' 
WHERE requires_auth = true AND auth_type IS NULL;

-- Add indexes for the new columns if needed
CREATE INDEX IF NOT EXISTS idx_custom_webhooks_auth_type ON custom_webhooks(auth_type) WHERE requires_auth = true;