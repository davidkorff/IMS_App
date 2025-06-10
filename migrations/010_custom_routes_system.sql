-- Migration 010: Custom Routes System for Form Builder and Intake Workflow
-- This creates the foundation for building custom intake forms and managing submission workflows

-- Table for storing custom route definitions (the form builder configurations)
CREATE TABLE custom_routes (
    route_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES ims_instances(instance_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL, -- URL-friendly identifier
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Form configuration stored as JSON
    form_config JSONB NOT NULL DEFAULT '{}',
    
    -- Workflow configuration
    workflow_config JSONB NOT NULL DEFAULT '{}',
    
    -- IMS integration settings
    ims_config JSONB NOT NULL DEFAULT '{}',
    
    -- Rater integration settings  
    rater_config JSONB DEFAULT NULL,
    
    -- Analytics and tracking
    submission_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique slug per instance
    UNIQUE(instance_id, slug)
);

-- Table for storing form field definitions
CREATE TABLE custom_route_fields (
    field_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id) ON DELETE CASCADE,
    
    -- Field identification
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- text, select, checkbox, radio, file, etc.
    field_label VARCHAR(255) NOT NULL,
    
    -- Field configuration
    field_config JSONB NOT NULL DEFAULT '{}', -- validation rules, options, etc.
    
    -- Form layout
    step_number INTEGER NOT NULL DEFAULT 1,
    field_order INTEGER NOT NULL DEFAULT 0,
    
    -- IMS mapping
    ims_field_mapping VARCHAR(255), -- maps to IMS webservice field
    rater_cell_mapping VARCHAR(100), -- maps to specific rater cell
    
    -- Field behavior
    is_required BOOLEAN DEFAULT FALSE,
    is_conditional BOOLEAN DEFAULT FALSE,
    conditional_logic JSONB DEFAULT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing form submissions from end users
CREATE TABLE custom_route_submissions (
    submission_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id),
    
    -- Submission tracking
    submission_uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    applicant_email VARCHAR(255),
    applicant_name VARCHAR(255),
    
    -- Form data submitted by end user
    form_data JSONB NOT NULL DEFAULT '{}',
    
    -- IMS integration tracking
    ims_submission_guid UUID,
    ims_quote_guid UUID,
    ims_policy_number VARCHAR(100),
    
    -- Workflow status
    status VARCHAR(50) DEFAULT 'submitted', -- submitted, processing, quoted, bound, issued, rejected
    workflow_step VARCHAR(100),
    
    -- Referral and approval tracking
    requires_underwriter_review BOOLEAN DEFAULT FALSE,
    underwriter_assigned VARCHAR(255),
    underwriter_notes TEXT,
    
    -- Rater integration
    rater_data JSONB DEFAULT NULL,
    rater_calculated_premium DECIMAL(12,2),
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking workflow actions and history
CREATE TABLE custom_route_workflow_log (
    log_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES custom_route_submissions(submission_id) ON DELETE CASCADE,
    
    action VARCHAR(100) NOT NULL, -- submitted, validated, ims_created, quoted, etc.
    status_from VARCHAR(50),
    status_to VARCHAR(50),
    
    actor VARCHAR(255), -- system, underwriter email, etc.
    notes TEXT,
    
    -- Additional data for the action
    action_data JSONB DEFAULT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing rater configurations and mappings
CREATE TABLE custom_route_raters (
    rater_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id) ON DELETE CASCADE,
    
    rater_name VARCHAR(255) NOT NULL,
    rater_file_path VARCHAR(500),
    
    -- Dynamic data table reference
    dynamic_table_name VARCHAR(255), -- e.g., dynamic_data_WorkersComp
    
    -- Field mappings from form to rater cells
    field_mappings JSONB NOT NULL DEFAULT '{}',
    
    -- Calculation settings
    auto_calculate BOOLEAN DEFAULT TRUE,
    calculation_endpoint VARCHAR(500),
    
    -- Workflow rules
    requires_review_if JSONB DEFAULT NULL, -- conditions that trigger review
    auto_bind_if JSONB DEFAULT NULL, -- conditions that allow auto-binding
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for caching IMS configuration data per instance
CREATE TABLE ims_configuration_cache (
    cache_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES ims_instances(instance_id) ON DELETE CASCADE,
    
    config_type VARCHAR(50) NOT NULL, -- company_lines, business_types, etc.
    config_data JSONB NOT NULL,
    
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(instance_id, config_type)
);

-- Create indexes for performance
CREATE INDEX idx_custom_routes_instance_active ON custom_routes(instance_id, is_active);
CREATE INDEX idx_custom_routes_slug ON custom_routes(slug);
CREATE INDEX idx_custom_route_fields_route_step ON custom_route_fields(route_id, step_number, field_order);
CREATE INDEX idx_custom_route_submissions_route_status ON custom_route_submissions(route_id, status);
CREATE INDEX idx_custom_route_submissions_uuid ON custom_route_submissions(submission_uuid);
CREATE INDEX idx_custom_route_submissions_ims_guids ON custom_route_submissions(ims_submission_guid, ims_quote_guid);
CREATE INDEX idx_workflow_log_submission ON custom_route_workflow_log(submission_id, created_at);
CREATE INDEX idx_ims_config_cache_lookup ON ims_configuration_cache(instance_id, config_type, expires_at);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_custom_routes_updated_at 
    BEFORE UPDATE ON custom_routes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_route_fields_updated_at 
    BEFORE UPDATE ON custom_route_fields 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_route_submissions_updated_at 
    BEFORE UPDATE ON custom_route_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_route_raters_updated_at 
    BEFORE UPDATE ON custom_route_raters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ims_configuration_cache_updated_at 
    BEFORE UPDATE ON ims_configuration_cache 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE custom_routes IS 'Master table for custom intake route definitions';
COMMENT ON TABLE custom_route_fields IS 'Field definitions for each custom route form';
COMMENT ON TABLE custom_route_submissions IS 'Individual submissions from end users filling out forms';
COMMENT ON TABLE custom_route_workflow_log IS 'Audit trail of all workflow actions and status changes';
COMMENT ON TABLE custom_route_raters IS 'Rater configurations and field mappings for calculations';
COMMENT ON TABLE ims_configuration_cache IS 'Cached IMS configuration data to reduce API calls';

COMMENT ON COLUMN custom_routes.form_config IS 'JSON configuration for form layout, steps, and behavior';
COMMENT ON COLUMN custom_routes.workflow_config IS 'JSON configuration for workflow rules and automation';
COMMENT ON COLUMN custom_routes.ims_config IS 'JSON configuration for IMS integration settings';
COMMENT ON COLUMN custom_route_fields.field_config IS 'JSON configuration for field validation, options, and behavior';
COMMENT ON COLUMN custom_route_submissions.form_data IS 'Complete form data submitted by the end user';
COMMENT ON COLUMN custom_route_raters.field_mappings IS 'JSON mapping from form fields to rater cells';