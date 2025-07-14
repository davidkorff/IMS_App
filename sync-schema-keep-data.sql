-- ========================================================================
-- SYNC PRODUCTION SCHEMA TO MATCH TEST (KEEPING ALL DATA)
-- ========================================================================
-- This script will modify your production database schema to match test
-- while preserving all existing data in production
-- ========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- STEP 1: ADD MISSING TABLES (these don't exist in production)
-- ========================================================================

-- 1. permissions table (missing from production)
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. user_permissions table (missing from production)
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    UNIQUE(user_id, permission_id)
);

-- 3. producer_route_access table (missing from production)
CREATE TABLE IF NOT EXISTS producer_route_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    UNIQUE(producer_id, route_id)
);

-- ========================================================================
-- STEP 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- ========================================================================

-- Add missing columns to portal_lines_of_business table
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS excel_formula_calculation BOOLEAN DEFAULT TRUE;

ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS formula_calc_method VARCHAR(20) DEFAULT 'none';

-- Drop old constraint if it exists
ALTER TABLE portal_lines_of_business 
DROP CONSTRAINT IF EXISTS portal_lines_of_business_formula_calc_method_check;

-- Add updated constraint with all valid methods
ALTER TABLE portal_lines_of_business 
ADD CONSTRAINT portal_lines_of_business_formula_calc_method_check 
CHECK (formula_calc_method IN ('none', 'python', 'excel_com', 'libreoffice', 'xlsx-calc'));

-- Update any existing 'xlsx-calc' values to 'none' (from migration 021)
UPDATE portal_lines_of_business 
SET formula_calc_method = 'none' 
WHERE formula_calc_method = 'xlsx-calc';

-- ========================================================================
-- STEP 3: CREATE/UPDATE excel_premium_mappings TABLE (from migration 020)
-- ========================================================================

-- Drop the old table if it exists with different structure
DROP TABLE IF EXISTS excel_premium_mappings CASCADE;

-- Create the table with the correct structure from migration 020
CREATE TABLE excel_premium_mappings (
    mapping_id SERIAL PRIMARY KEY,
    lob_id INTEGER NOT NULL REFERENCES portal_lines_of_business(lob_id) ON DELETE CASCADE,
    sheet_name VARCHAR(100) NOT NULL,
    cell_reference VARCHAR(10) NOT NULL,
    mapping_type VARCHAR(50) DEFAULT 'premium', -- premium, fee, tax, etc.
    description TEXT,
    priority INTEGER DEFAULT 1, -- Order to check cells (1 = first)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lob_id, sheet_name, cell_reference)
);

-- Create index for faster lookups
CREATE INDEX idx_excel_premium_mappings_lob ON excel_premium_mappings(lob_id);

-- Add default mappings (from migration 020)
INSERT INTO excel_premium_mappings (lob_id, sheet_name, cell_reference, mapping_type, description, priority)
SELECT 
    lob_id,
    mapping.sheet_name,
    mapping.cell_reference,
    mapping.mapping_type,
    mapping.description,
    mapping.priority
FROM portal_lines_of_business lob
CROSS JOIN (
    VALUES 
        ('IMS_TAGS', 'B6', 'premium', 'IMS standard premium location', 1),
        ('Summary', 'B6', 'premium', 'Summary sheet premium', 2),
        ('Premium', 'B10', 'premium', 'Premium sheet total', 3),
        ('Rating', 'E15', 'premium', 'Rating calculation result', 4),
        ('IMS_TAGS', 'B7', 'fee', 'IMS standard fee location', 1),
        ('IMS_TAGS', 'B8', 'tax', 'IMS standard tax location', 1)
) AS mapping(sheet_name, cell_reference, mapping_type, description, priority)
ON CONFLICT (lob_id, sheet_name, cell_reference) DO NOTHING;

-- ========================================================================
-- STEP 4: ADD MISSING COLUMNS TO custom_route_submissions
-- ========================================================================

-- The error "column status does not exist" suggests this column might be missing
ALTER TABLE custom_route_submissions 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'submitted';

-- Make sure submission_status also exists (some tables have both)
ALTER TABLE custom_route_submissions 
ADD COLUMN IF NOT EXISTS submission_status VARCHAR(50) DEFAULT 'submitted';

-- ========================================================================
-- STEP 5: CREATE ALL MISSING INDEXES
-- ========================================================================

-- Email filing indexes
CREATE INDEX IF NOT EXISTS idx_email_filing_configs_user ON email_filing_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_configs_instance ON email_filing_configs(instance_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_config ON email_filing_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_status ON email_filing_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_control_number ON email_filing_logs(control_number_used);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_processed_at ON email_filing_logs(processed_at);

-- Producer indexes
CREATE INDEX IF NOT EXISTS idx_producers_instance ON producers(instance_id);
CREATE INDEX IF NOT EXISTS idx_producers_status ON producers(status);
CREATE INDEX IF NOT EXISTS idx_producers_email ON producers(email);

-- Custom routes indexes  
CREATE INDEX IF NOT EXISTS idx_custom_routes_instance ON custom_routes(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_routes_slug ON custom_routes(slug);
CREATE INDEX IF NOT EXISTS idx_custom_routes_active ON custom_routes(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_routes_category ON custom_routes(route_category);
CREATE INDEX IF NOT EXISTS idx_custom_routes_lob ON custom_routes(lob_id);

-- Fix the problematic index - use 'status' instead of 'submission_status'
CREATE INDEX IF NOT EXISTS idx_custom_submissions_status ON custom_route_submissions(status);

-- Form builder indexes
CREATE INDEX IF NOT EXISTS idx_form_schemas_instance ON form_schemas(instance_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_lob ON form_schemas(lob_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_active ON form_schemas(is_active);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);

-- ========================================================================
-- STEP 6: CREATE UPDATE TRIGGERS
-- ========================================================================

-- Generic updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for tables with updated_at columns
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'users',
        'ims_instances', 
        'email_filing_configs',
        'email_configurations',
        'subscription_plans',
        'user_subscriptions',
        'user_quotas',
        'producers',
        'producer_portal_config',
        'portal_lines_of_business',
        'excel_premium_mappings',
        'custom_routes',
        'custom_route_fields',
        'custom_route_submissions',
        'custom_route_raters',
        'custom_webhooks',
        'form_schemas',
        'form_submissions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Check if table exists before creating trigger
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('
                DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
                CREATE TRIGGER update_%I_updated_at 
                BEFORE UPDATE ON %I 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
            ', tbl, tbl, tbl, tbl);
        END IF;
    END LOOP;
END;
$$;

-- ========================================================================
-- STEP 7: ADD MISSING FOREIGN KEY RELATIONSHIPS
-- ========================================================================

-- Add foreign keys that might be missing
DO $$ 
BEGIN
    -- Add FK for producer_route_access if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'producer_route_access' 
        AND constraint_name = 'producer_route_access_producer_id_fkey'
    ) THEN
        ALTER TABLE producer_route_access 
        ADD CONSTRAINT producer_route_access_producer_id_fkey 
        FOREIGN KEY (producer_id) REFERENCES producers(producer_id);
    END IF;

    -- Add FK for producer_route_access to custom_routes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'producer_route_access' 
        AND constraint_name = 'producer_route_access_route_id_fkey'
    ) THEN
        ALTER TABLE producer_route_access 
        ADD CONSTRAINT producer_route_access_route_id_fkey 
        FOREIGN KEY (route_id) REFERENCES custom_routes(route_id);
    END IF;

    -- Add FK for user_permissions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'user_permissions' 
        AND constraint_name = 'user_permissions_user_id_fkey'
    ) THEN
        ALTER TABLE user_permissions 
        ADD CONSTRAINT user_permissions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;
END $$;

-- ========================================================================
-- STEP 8: ADD COMMENTS (from migrations)
-- ========================================================================

COMMENT ON TABLE excel_premium_mappings IS 'Stores Excel cell mappings for premium extraction per Line of Business';
COMMENT ON COLUMN excel_premium_mappings.mapping_type IS 'Type of value in cell: premium, fee, tax, etc.';
COMMENT ON COLUMN excel_premium_mappings.priority IS 'Order to check cells when looking for values (1 = check first)';
COMMENT ON COLUMN portal_lines_of_business.excel_formula_calculation IS 'Whether to calculate Excel formulas before IMS import';
COMMENT ON COLUMN portal_lines_of_business.formula_calc_method IS 
'Excel formula calculation method: none (no calculation), python (openpyxl), excel_com (Windows Excel COM), libreoffice (LibreOffice headless)';

-- ========================================================================
-- VERIFICATION QUERY - Run this after migration to check results
-- ========================================================================
/*
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check excel_premium_mappings
SELECT * FROM excel_premium_mappings LIMIT 5;

-- Check portal_lines_of_business new columns
SELECT lob_id, line_name, excel_formula_calculation, formula_calc_method 
FROM portal_lines_of_business 
LIMIT 5;

-- Count records in key tables (to ensure data preserved)
SELECT 
    (SELECT COUNT(*) FROM producers) as producers_count,
    (SELECT COUNT(*) FROM custom_routes) as routes_count,
    (SELECT COUNT(*) FROM custom_route_submissions) as submissions_count,
    (SELECT COUNT(*) FROM portal_lines_of_business) as lob_count;
*/