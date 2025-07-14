-- ========================================================================
-- FIX PRODUCTION SCHEMA - CREATES ALL MISSING TABLES
-- ========================================================================
-- This script adds all missing tables to match test database
-- Run this BEFORE the full migration to ensure dependencies exist
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- CREATE ALL MISSING TABLES (without foreign keys first)
-- ========================================================================

-- 1. Producers table (required for many other tables)
CREATE TABLE IF NOT EXISTS producers (
    producer_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    agency_name VARCHAR(255),
    phone VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),
    ims_producer_guid VARCHAR(36),
    ims_producer_contact_guid VARCHAR(36),
    ims_producer_location_guid VARCHAR(36),
    status VARCHAR(50) DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by INTEGER,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- 2. Portal lines of business (required for excel mappings and routes)
CREATE TABLE IF NOT EXISTS portal_lines_of_business (
    lob_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    line_name VARCHAR(255) NOT NULL,
    line_code VARCHAR(50),
    description TEXT,
    ims_line_guid VARCHAR(36),
    ims_company_guid VARCHAR(36),
    ims_company_location_guid VARCHAR(36),
    ims_quoting_location_guid VARCHAR(36),
    ims_issuing_location_guid VARCHAR(36),
    ims_procedure_guid VARCHAR(36),
    rater_template_path VARCHAR(500),
    rater_config TEXT,
    rater_file BYTEA,
    rating_type VARCHAR(50),
    min_premium DECIMAL(10,2),
    max_premium DECIMAL(10,2),
    auto_bind_limit DECIMAL(10,2),
    requires_underwriter_approval BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    form_schema_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    underwriter_guid VARCHAR(36),
    underwriter_location_guid VARCHAR(36),
    excel_formula_calculation BOOLEAN DEFAULT TRUE,
    formula_calc_method VARCHAR(20) DEFAULT 'none'
);

-- 3. Custom routes (required for submissions)
CREATE TABLE IF NOT EXISTS custom_routes (
    route_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,
    route_type VARCHAR(50) DEFAULT 'form',
    form_config JSONB DEFAULT '{}',
    workflow_config JSONB DEFAULT '{}',
    ims_config JSONB DEFAULT '{}',
    rater_config JSONB,
    settings JSONB,
    is_active BOOLEAN DEFAULT true,
    submission_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    route_category VARCHAR(50) DEFAULT 'general',
    producer_access_level VARCHAR(50) DEFAULT 'all',
    lob_id INTEGER,
    min_fields_required INTEGER DEFAULT 0,
    max_submissions_per_day INTEGER DEFAULT 100
);

-- 4. Custom route submissions (the table with the status column issue)
CREATE TABLE IF NOT EXISTS custom_route_submissions (
    submission_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,
    instance_id INTEGER,
    submission_uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    submission_guid UUID,
    applicant_email VARCHAR(255),
    applicant_name VARCHAR(255),
    form_data JSONB NOT NULL DEFAULT '{}',
    submission_status VARCHAR(50) DEFAULT 'submitted',
    status VARCHAR(50) DEFAULT 'submitted',
    workflow_status JSONB,
    workflow_step VARCHAR(100),
    ims_submission_guid UUID,
    ims_quote_guid UUID,
    ims_policy_guid VARCHAR(36),
    ims_policy_number VARCHAR(100),
    requires_underwriter_review BOOLEAN DEFAULT false,
    underwriter_assigned VARCHAR(255),
    underwriter_notes TEXT,
    rater_premium DECIMAL(10,2),
    rater_data JSONB,
    rater_calculated_premium NUMERIC(12,2),
    ip_address VARCHAR(45),
    user_agent TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Form schemas (required for form submissions)
CREATE TABLE IF NOT EXISTS form_schemas (
    form_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id INTEGER NOT NULL,
    lob_id INTEGER,
    schema_version VARCHAR(10) DEFAULT '1.0',
    title VARCHAR(255),
    description TEXT,
    form_name VARCHAR(255),
    form_config JSONB,
    form_schema JSONB,
    field_mappings JSONB,
    validation_rules JSONB,
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

-- 6. Form submissions
CREATE TABLE IF NOT EXISTS form_submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL,
    instance_id INTEGER,
    producer_id INTEGER,
    producer_submission_id INTEGER,
    submission_guid UUID,
    submission_data JSONB,
    form_data JSONB,
    form_state JSONB,
    is_draft BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Other missing tables
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    UNIQUE(user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS producer_route_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    UNIQUE(producer_id, route_id)
);

CREATE TABLE IF NOT EXISTS producer_sessions (
    session_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS producer_submissions (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL,
    producer_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS producer_portal_config (
    config_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    portal_name VARCHAR(255),
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#0066CC',
    secondary_color VARCHAR(7) DEFAULT '#333333',
    custom_css TEXT,
    custom_js TEXT,
    welcome_message TEXT,
    terms_of_service TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS producer_lob_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    lob_id INTEGER NOT NULL,
    can_quote BOOLEAN DEFAULT true,
    can_bind BOOLEAN DEFAULT false,
    commission_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(producer_id, lob_id)
);

CREATE TABLE IF NOT EXISTS producer_audit_log (
    log_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_route_fields (
    field_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_config JSONB DEFAULT '{}',
    validation_rules JSONB,
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_conditional BOOLEAN DEFAULT false,
    conditional_logic JSONB,
    step_number INTEGER DEFAULT 1,
    field_order INTEGER DEFAULT 0,
    ims_field_mapping VARCHAR(255),
    rater_field_mapping VARCHAR(255),
    rater_cell_mapping VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_route_workflow_log (
    log_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    status_from VARCHAR(50),
    status_to VARCHAR(50),
    actor VARCHAR(255),
    notes TEXT,
    details JSONB,
    action_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_route_raters (
    rater_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,
    rater_name VARCHAR(255) NOT NULL,
    rater_file_path VARCHAR(500),
    dynamic_table_name VARCHAR(255),
    field_mappings JSONB DEFAULT '{}',
    auto_calculate BOOLEAN DEFAULT true,
    calculation_endpoint VARCHAR(500),
    requires_review_if JSONB,
    auto_bind_if JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ims_configuration_cache (
    cache_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    cache_key VARCHAR(255) NOT NULL,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instance_id, cache_key)
);

CREATE TABLE IF NOT EXISTS form_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_schema JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);

CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- CREATE EXCEL PREMIUM MAPPINGS TABLE (from migration 020)
-- ========================================================================

CREATE TABLE IF NOT EXISTS excel_premium_mappings (
    mapping_id SERIAL PRIMARY KEY,
    lob_id INTEGER NOT NULL,
    sheet_name VARCHAR(100) NOT NULL,
    cell_reference VARCHAR(10) NOT NULL,
    mapping_type VARCHAR(50) DEFAULT 'premium',
    description TEXT,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lob_id, sheet_name, cell_reference)
);

-- ========================================================================
-- NOW ADD ALL THE FOREIGN KEYS (after all tables exist)
-- ========================================================================

-- Add foreign keys only if they don't exist
DO $$ 
BEGIN
    -- Custom routes to LOB
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_routes_lob_id_fkey') THEN
        ALTER TABLE custom_routes ADD CONSTRAINT custom_routes_lob_id_fkey FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id);
    END IF;

    -- Custom route submissions to routes
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_route_submissions_route_id_fkey') THEN
        ALTER TABLE custom_route_submissions ADD CONSTRAINT custom_route_submissions_route_id_fkey FOREIGN KEY (route_id) REFERENCES custom_routes(route_id);
    END IF;

    -- Form schemas to LOB
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'form_schemas_lob_id_fkey') THEN
        ALTER TABLE form_schemas ADD CONSTRAINT form_schemas_lob_id_fkey FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id);
    END IF;

    -- Form submissions to form schemas
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'form_submissions_form_id_fkey') THEN
        ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES form_schemas(form_id);
    END IF;

    -- Producer related foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'producer_sessions_producer_id_fkey') THEN
        ALTER TABLE producer_sessions ADD CONSTRAINT producer_sessions_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES producers(producer_id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'producer_submissions_producer_id_fkey') THEN
        ALTER TABLE producer_submissions ADD CONSTRAINT producer_submissions_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES producers(producer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'producer_lob_access_producer_id_fkey') THEN
        ALTER TABLE producer_lob_access ADD CONSTRAINT producer_lob_access_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES producers(producer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'producer_lob_access_lob_id_fkey') THEN
        ALTER TABLE producer_lob_access ADD CONSTRAINT producer_lob_access_lob_id_fkey FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'producer_audit_log_producer_id_fkey') THEN
        ALTER TABLE producer_audit_log ADD CONSTRAINT producer_audit_log_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES producers(producer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'producer_route_access_producer_id_fkey') THEN
        ALTER TABLE producer_route_access ADD CONSTRAINT producer_route_access_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES producers(producer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'producer_route_access_route_id_fkey') THEN
        ALTER TABLE producer_route_access ADD CONSTRAINT producer_route_access_route_id_fkey FOREIGN KEY (route_id) REFERENCES custom_routes(route_id);
    END IF;

    -- User permissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_permissions_permission_id_fkey') THEN
        ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions(permission_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_permissions_user_id_fkey') THEN
        ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id);
    END IF;

    -- Excel premium mappings to LOB
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'excel_premium_mappings_lob_id_fkey') THEN
        ALTER TABLE excel_premium_mappings ADD CONSTRAINT excel_premium_mappings_lob_id_fkey FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id) ON DELETE CASCADE;
    END IF;

    -- Custom route fields to routes
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_route_fields_route_id_fkey') THEN
        ALTER TABLE custom_route_fields ADD CONSTRAINT custom_route_fields_route_id_fkey FOREIGN KEY (route_id) REFERENCES custom_routes(route_id) ON DELETE CASCADE;
    END IF;

    -- Workflow log to submissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_route_workflow_log_submission_id_fkey') THEN
        ALTER TABLE custom_route_workflow_log ADD CONSTRAINT custom_route_workflow_log_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES custom_route_submissions(submission_id);
    END IF;

    -- Custom route raters to routes
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_route_raters_route_id_fkey') THEN
        ALTER TABLE custom_route_raters ADD CONSTRAINT custom_route_raters_route_id_fkey FOREIGN KEY (route_id) REFERENCES custom_routes(route_id) ON DELETE CASCADE;
    END IF;

    -- Form submissions to producer
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'form_submissions_producer_id_fkey') THEN
        ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES producers(producer_id);
    END IF;
END $$;

-- ========================================================================
-- ADD CONSTRAINTS
-- ========================================================================

-- Add check constraints
ALTER TABLE producers DROP CONSTRAINT IF EXISTS check_status;
ALTER TABLE producers ADD CONSTRAINT check_status CHECK (status IN ('pending', 'approved', 'suspended', 'inactive'));

ALTER TABLE portal_lines_of_business DROP CONSTRAINT IF EXISTS portal_lines_of_business_formula_calc_method_check;
ALTER TABLE portal_lines_of_business ADD CONSTRAINT portal_lines_of_business_formula_calc_method_check 
CHECK (formula_calc_method IN ('none', 'python', 'excel_com', 'libreoffice', 'xlsx-calc'));

-- Update any existing 'xlsx-calc' values to 'none'
UPDATE portal_lines_of_business SET formula_calc_method = 'none' WHERE formula_calc_method = 'xlsx-calc';

-- ========================================================================
-- CREATE INDEXES (only after tables and columns exist)
-- ========================================================================

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

-- Custom submissions indexes - FIXED: using 'status' column
CREATE INDEX IF NOT EXISTS idx_custom_submissions_route ON custom_route_submissions(route_id);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_instance ON custom_route_submissions(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_status ON custom_route_submissions(status);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_submission_status ON custom_route_submissions(submission_status);

-- Form indexes
CREATE INDEX IF NOT EXISTS idx_form_schemas_instance ON form_schemas(instance_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_lob ON form_schemas(lob_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_active ON form_schemas(is_active);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);

-- Excel mappings index
CREATE INDEX IF NOT EXISTS idx_excel_premium_mappings_lob ON excel_premium_mappings(lob_id);

-- ========================================================================
-- FINAL STEP: Insert default excel mappings if LOBs exist
-- ========================================================================

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
WHERE EXISTS (SELECT 1 FROM portal_lines_of_business LIMIT 1)
ON CONFLICT (lob_id, sheet_name, cell_reference) DO NOTHING;

-- ========================================================================
-- SUCCESS MESSAGE
-- ========================================================================
-- All tables should now be created with proper dependencies!