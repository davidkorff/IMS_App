-- Migration: Producer Portal Foundation (PostgreSQL)
-- Description: Creates the foundational tables for the producer portal feature
-- Date: 2025-01-02

-- Producer portal configuration (extends existing subdomain system)
CREATE TABLE IF NOT EXISTS producer_portal_config (
    config_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    portal_name VARCHAR(255),
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#0066CC',
    secondary_color VARCHAR(7) DEFAULT '#333333',
    custom_css TEXT,
    welcome_message TEXT,
    terms_of_service TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

-- Create index for instance lookup
CREATE INDEX IF NOT EXISTS idx_producer_portal_config_instance ON producer_portal_config(instance_id);

-- Producer management table
CREATE TABLE IF NOT EXISTS producers (
    producer_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
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
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, suspended, inactive
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
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

-- Create unique index for email within instance
CREATE UNIQUE INDEX IF NOT EXISTS idx_producer_email_instance ON producers(email, instance_id);
CREATE INDEX IF NOT EXISTS idx_producer_status ON producers(status);
CREATE INDEX IF NOT EXISTS idx_producer_instance ON producers(instance_id);

-- Producer sessions for authentication
CREATE TABLE IF NOT EXISTS producer_sessions (
    session_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_producer_session_token ON producer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_producer_session_expires ON producer_sessions(expires_at);

-- Link submissions to producers
CREATE TABLE IF NOT EXISTS producer_submissions (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL,
    producer_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES custom_route_submissions(submission_id),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id)
);

CREATE INDEX IF NOT EXISTS idx_producer_submissions_producer ON producer_submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_producer_submissions_submission ON producer_submissions(submission_id);

-- Lines of business configuration for producer portal
CREATE TABLE IF NOT EXISTS portal_lines_of_business (
    lob_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    line_name VARCHAR(255) NOT NULL,
    line_code VARCHAR(50),
    description TEXT,
    ims_line_guid VARCHAR(36),
    ims_company_location_guid VARCHAR(36),
    ims_quoting_location_guid VARCHAR(36),
    ims_issuing_location_guid VARCHAR(36),
    rater_template_path VARCHAR(500),
    rater_config TEXT, -- JSON configuration
    min_premium DECIMAL(10,2),
    max_premium DECIMAL(10,2),
    auto_bind_limit DECIMAL(10,2),
    requires_underwriter_approval BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_lob_instance ON portal_lines_of_business(instance_id);
CREATE INDEX IF NOT EXISTS idx_portal_lob_active ON portal_lines_of_business(is_active);

-- Producer access to lines of business
CREATE TABLE IF NOT EXISTS producer_lob_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    lob_id INTEGER NOT NULL,
    can_quote BOOLEAN DEFAULT true,
    can_bind BOOLEAN DEFAULT false,
    commission_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id),
    FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id),
    UNIQUE(producer_id, lob_id)
);

-- Audit log for producer actions
CREATE TABLE IF NOT EXISTS producer_audit_log (
    log_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id)
);

CREATE INDEX IF NOT EXISTS idx_producer_audit_producer ON producer_audit_log(producer_id);
CREATE INDEX IF NOT EXISTS idx_producer_audit_created ON producer_audit_log(created_at);

-- Enhance custom_routes table for producer portal (if columns don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_routes' AND column_name='route_category') THEN
        ALTER TABLE custom_routes ADD COLUMN route_category VARCHAR(50) DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_routes' AND column_name='producer_access_level') THEN
        ALTER TABLE custom_routes ADD COLUMN producer_access_level VARCHAR(50) DEFAULT 'all';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_routes' AND column_name='rater_config') THEN
        ALTER TABLE custom_routes ADD COLUMN rater_config TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_routes' AND column_name='lob_id') THEN
        ALTER TABLE custom_routes ADD COLUMN lob_id INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_routes' AND column_name='min_fields_required') THEN
        ALTER TABLE custom_routes ADD COLUMN min_fields_required INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_routes' AND column_name='max_submissions_per_day') THEN
        ALTER TABLE custom_routes ADD COLUMN max_submissions_per_day INTEGER DEFAULT 100;
    END IF;
END $$;

-- Add foreign key for lob_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'custom_routes' 
        AND constraint_name = 'custom_routes_lob_id_fkey'
    ) THEN
        ALTER TABLE custom_routes ADD CONSTRAINT custom_routes_lob_id_fkey 
        FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id);
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_custom_routes_category ON custom_routes(route_category);
CREATE INDEX IF NOT EXISTS idx_custom_routes_lob ON custom_routes(lob_id);

-- Default producer portal configuration for existing instances
INSERT INTO producer_portal_config (instance_id, portal_name, welcome_message)
SELECT 
    instance_id,
    name || ' Producer Portal',
    'Welcome to ' || name || ' Producer Portal. Please login or register to submit quotes.'
FROM ims_instances
WHERE NOT EXISTS (
    SELECT 1 FROM producer_portal_config 
    WHERE producer_portal_config.instance_id = ims_instances.instance_id
);

-- Add producer portal permissions (if permissions table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
        INSERT INTO permissions (permission_name, description, category)
        VALUES 
            ('producer_portal.view', 'View producer portal configuration', 'Producer Portal'),
            ('producer_portal.manage', 'Manage producer portal settings', 'Producer Portal'),
            ('producer_portal.producers.view', 'View producers', 'Producer Portal'),
            ('producer_portal.producers.approve', 'Approve/reject producers', 'Producer Portal'),
            ('producer_portal.producers.manage', 'Full producer management', 'Producer Portal'),
            ('producer_portal.lob.manage', 'Manage lines of business', 'Producer Portal'),
            ('producer_portal.submissions.view', 'View producer submissions', 'Producer Portal')
        ON CONFLICT (permission_name) DO NOTHING;
    END IF;
END $$;

-- Grant producer portal permissions to admin role (if roles exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') 
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.role_name = 'admin' 
        AND p.category = 'Producer Portal'
        AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp 
            WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
        );
    END IF;
END $$;