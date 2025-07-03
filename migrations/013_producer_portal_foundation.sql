-- Migration: Producer Portal Foundation
-- Description: Creates the foundational tables for the producer portal feature
-- Date: 2025-01-02

-- Producer portal configuration (extends existing subdomain system)
CREATE TABLE producer_portal_config (
    config_id INT PRIMARY KEY IDENTITY(1,1),
    instance_id INT NOT NULL,
    portal_name NVARCHAR(255),
    logo_url NVARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#0066CC',
    secondary_color VARCHAR(7) DEFAULT '#333333',
    custom_css TEXT,
    welcome_message TEXT,
    terms_of_service TEXT,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

-- Create index for instance lookup
CREATE INDEX idx_producer_portal_config_instance ON producer_portal_config(instance_id);

-- Producer management table
CREATE TABLE producers (
    producer_id INT PRIMARY KEY IDENTITY(1,1),
    instance_id INT NOT NULL,
    email NVARCHAR(255) NOT NULL,
    password_hash NVARCHAR(255),
    first_name NVARCHAR(100),
    last_name NVARCHAR(100),
    agency_name NVARCHAR(255),
    phone NVARCHAR(20),
    address_line1 NVARCHAR(255),
    address_line2 NVARCHAR(255),
    city NVARCHAR(100),
    state NVARCHAR(2),
    zip NVARCHAR(10),
    ims_producer_guid VARCHAR(36),
    ims_producer_contact_guid VARCHAR(36),
    ims_producer_location_guid VARCHAR(36),
    status NVARCHAR(50) DEFAULT 'pending', -- pending, approved, suspended, inactive
    email_verified BIT DEFAULT 0,
    email_verification_token NVARCHAR(255),
    email_verification_expires DATETIME,
    password_reset_token NVARCHAR(255),
    password_reset_expires DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    approved_at DATETIME,
    approved_by INT,
    last_login DATETIME,
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

-- Create unique index for email within instance
CREATE UNIQUE INDEX idx_producer_email_instance ON producers(email, instance_id);
CREATE INDEX idx_producer_status ON producers(status);
CREATE INDEX idx_producer_instance ON producers(instance_id);

-- Producer sessions for authentication
CREATE TABLE producer_sessions (
    session_id INT PRIMARY KEY IDENTITY(1,1),
    producer_id INT NOT NULL,
    token NVARCHAR(255) NOT NULL,
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500),
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_producer_session_token ON producer_sessions(token);
CREATE INDEX idx_producer_session_expires ON producer_sessions(expires_at);

-- Link submissions to producers
CREATE TABLE producer_submissions (
    id INT PRIMARY KEY IDENTITY(1,1),
    submission_id INT NOT NULL,
    producer_id INT NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (submission_id) REFERENCES custom_route_submissions(submission_id),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id)
);

CREATE INDEX idx_producer_submissions_producer ON producer_submissions(producer_id);
CREATE INDEX idx_producer_submissions_submission ON producer_submissions(submission_id);

-- Lines of business configuration for producer portal
CREATE TABLE portal_lines_of_business (
    lob_id INT PRIMARY KEY IDENTITY(1,1),
    instance_id INT NOT NULL,
    line_name NVARCHAR(255) NOT NULL,
    line_code NVARCHAR(50),
    description TEXT,
    ims_line_guid VARCHAR(36),
    ims_company_location_guid VARCHAR(36),
    ims_quoting_location_guid VARCHAR(36),
    ims_issuing_location_guid VARCHAR(36),
    rater_template_path NVARCHAR(500),
    rater_config TEXT, -- JSON configuration
    min_premium DECIMAL(10,2),
    max_premium DECIMAL(10,2),
    auto_bind_limit DECIMAL(10,2),
    requires_underwriter_approval BIT DEFAULT 0,
    display_order INT DEFAULT 0,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (instance_id) REFERENCES ims_instances(instance_id)
);

CREATE INDEX idx_portal_lob_instance ON portal_lines_of_business(instance_id);
CREATE INDEX idx_portal_lob_active ON portal_lines_of_business(is_active);

-- Producer access to lines of business
CREATE TABLE producer_lob_access (
    access_id INT PRIMARY KEY IDENTITY(1,1),
    producer_id INT NOT NULL,
    lob_id INT NOT NULL,
    can_quote BIT DEFAULT 1,
    can_bind BIT DEFAULT 0,
    commission_rate DECIMAL(5,2),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id),
    FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id),
    UNIQUE(producer_id, lob_id)
);

-- Audit log for producer actions
CREATE TABLE producer_audit_log (
    log_id INT PRIMARY KEY IDENTITY(1,1),
    producer_id INT NOT NULL,
    action NVARCHAR(100) NOT NULL,
    details TEXT,
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id)
);

CREATE INDEX idx_producer_audit_producer ON producer_audit_log(producer_id);
CREATE INDEX idx_producer_audit_created ON producer_audit_log(created_at);

-- Enhance custom_routes table for producer portal
ALTER TABLE custom_routes ADD route_category NVARCHAR(50) DEFAULT 'general';
ALTER TABLE custom_routes ADD producer_access_level NVARCHAR(50) DEFAULT 'all'; -- all, approved, specific
ALTER TABLE custom_routes ADD rater_config TEXT; -- JSON for rater field mappings
ALTER TABLE custom_routes ADD lob_id INT NULL;
ALTER TABLE custom_routes ADD min_fields_required INT DEFAULT 0;
ALTER TABLE custom_routes ADD max_submissions_per_day INT DEFAULT 100;
ALTER TABLE custom_routes ADD FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id);

-- Create indexes for new columns
CREATE INDEX idx_custom_routes_category ON custom_routes(route_category);
CREATE INDEX idx_custom_routes_lob ON custom_routes(lob_id);

-- Default producer portal configuration for existing instances
INSERT INTO producer_portal_config (instance_id, portal_name, welcome_message)
SELECT 
    instance_id,
    name + ' Producer Portal',
    'Welcome to ' + name + ' Producer Portal. Please login or register to submit quotes.'
FROM ims_instances
WHERE NOT EXISTS (
    SELECT 1 FROM producer_portal_config 
    WHERE producer_portal_config.instance_id = ims_instances.instance_id
);

-- Add producer portal permissions
INSERT INTO permissions (permission_name, description, category)
VALUES 
    ('producer_portal.view', 'View producer portal configuration', 'Producer Portal'),
    ('producer_portal.manage', 'Manage producer portal settings', 'Producer Portal'),
    ('producer_portal.producers.view', 'View producers', 'Producer Portal'),
    ('producer_portal.producers.approve', 'Approve/reject producers', 'Producer Portal'),
    ('producer_portal.producers.manage', 'Full producer management', 'Producer Portal'),
    ('producer_portal.lob.manage', 'Manage lines of business', 'Producer Portal'),
    ('producer_portal.submissions.view', 'View producer submissions', 'Producer Portal');

-- Grant producer portal permissions to admin role
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