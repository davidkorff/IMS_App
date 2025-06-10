-- Rollback script for custom webhooks feature
-- ONLY run this if you need to completely remove the feature

-- Drop new columns from custom_webhooks (if you want to keep the table but remove new features)
ALTER TABLE custom_webhooks 
DROP COLUMN IF EXISTS auth_type,
DROP COLUMN IF EXISTS secret_key,
DROP COLUMN IF EXISTS allowed_ips;

-- Or completely remove all webhook tables (destructive!)
-- DROP TABLE IF EXISTS webhook_executions CASCADE;
-- DROP TABLE IF EXISTS webhook_templates CASCADE;
-- DROP TABLE IF EXISTS ims_function_mappings CASCADE;
-- DROP TABLE IF EXISTS custom_webhooks CASCADE;

-- Remove the trigger
-- DROP TRIGGER IF EXISTS update_custom_webhooks_updated_at ON custom_webhooks;

-- Remove from migrations table
-- DELETE FROM migrations WHERE name IN ('011_custom_webhooks.sql', '012_webhook_auth_enhancements.sql');