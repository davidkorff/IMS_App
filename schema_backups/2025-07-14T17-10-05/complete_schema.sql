-- Full Schema Migration from Test to Production
-- Generated: 2025-07-14T17:10:06.753Z
-- This will create all tables with proper structure

-- ========================================================================
-- PRODUCTION MIGRATION SCRIPT TO MATCH TEST DATABASE
-- ========================================================================
-- This script will update your production database to match your test database
-- All statements use IF NOT EXISTS for safety
-- Run this in production to ensure all tables/columns match test
-- ========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- MISSING TABLES (found in test but not in migration analysis)
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
-- EXISTING TABLES FROM TEST DB (ensure all exist with correct structure)
-- ========================================================================

-- Users table (note: you have both 'Users' and 'users' - consolidate?)
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IMS instances table
CREATE TABLE IF NOT EXISTS ims_instances (
    instance_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    unique_identifier VARCHAR(100) UNIQUE,
    email_subdomain VARCHAR(50),
    email_config JSONB,
    email_status VARCHAR(20),
    custom_domain VARCHAR(255),
    is_custom_domain_approved BOOLEAN DEFAULT false,
    is_email_approved BOOLEAN DEFAULT false,
    ims_token_encrypted BYTEA,
    ims_context_encrypted BYTEA,
    ims_base_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email filing configurations
CREATE TABLE IF NOT EXISTS email_filing_configs (
    config_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    instance_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255),
    default_folder_id VARCHAR(36),
    auto_extract_control_numbers BOOLEAN DEFAULT false,
    control_number_patterns JSONB,
    file_email_as_pdf BOOLEAN DEFAULT true,
    include_attachments BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_instance_name UNIQUE (user_id, instance_id, name)
);

-- Email filing logs
CREATE TABLE IF NOT EXISTS email_filing_logs (
    log_id SERIAL PRIMARY KEY,
    config_id INTEGER REFERENCES email_filing_configs(config_id),
    instance_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    email_subject TEXT,
    email_from TEXT,
    email_to TEXT,
    email_date TIMESTAMP,
    email_message_id TEXT,
    email_body_text TEXT,
    email_body_html TEXT,
    attachments_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    control_numbers_found JSONB,
    control_number_used VARCHAR(100),
    policy_guid VARCHAR(36),
    quote_guid VARCHAR(36),
    document_guid VARCHAR(36),
    folder_id VARCHAR(36),
    error_message TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_status CHECK (status IN ('pending', 'success', 'error', 'skipped'))
);

-- Email filing attachments
CREATE TABLE IF NOT EXISTS email_filing_attachments (
    attachment_id SERIAL PRIMARY KEY,
    log_id INTEGER NOT NULL REFERENCES email_filing_logs(log_id),
    filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(100),
    file_size INTEGER,
    ims_document_guid VARCHAR(36),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email configurations
CREATE TABLE IF NOT EXISTS email_configurations (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER REFERENCES ims_instances(instance_id),
    config_type VARCHAR(20) NOT NULL,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    email_prefix VARCHAR(100),
    email_system_type VARCHAR(20) DEFAULT 'graph',
    auto_extract_control_numbers BOOLEAN DEFAULT false,
    control_number_patterns JSONB,
    include_attachments BOOLEAN DEFAULT true,
    default_folder_id VARCHAR(36),
    test_status VARCHAR(20) DEFAULT 'not_tested',
    last_processed_timestamp TIMESTAMP,
    graph_client_id_encrypted TEXT,
    graph_client_secret_encrypted TEXT,
    graph_tenant_id_encrypted TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email processing logs
CREATE TABLE IF NOT EXISTS email_processing_logs (
    log_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    email_message_id VARCHAR(255),
    email_subject TEXT,
    email_from VARCHAR(255),
    email_to TEXT,
    email_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    processing_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reserved subdomains
CREATE TABLE IF NOT EXISTS reserved_subdomains (
    subdomain VARCHAR(50) PRIMARY KEY,
    reserved_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System config
CREATE TABLE IF NOT EXISTS system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL UNIQUE,
    monthly_price DECIMAL(10,2) NOT NULL,
    yearly_price DECIMAL(10,2),
    emails_per_month INTEGER,
    webhooks_per_month INTEGER,
    api_calls_per_month INTEGER,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(plan_id),
    status VARCHAR(50) DEFAULT 'active',
    billing_period VARCHAR(20) DEFAULT 'monthly',
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    trial_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_status CHECK (status IN ('active', 'suspended', 'cancelled', 'trial'))
);

-- Usage events
CREATE TABLE IF NOT EXISTS usage_events (
    event_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    instance_id INTEGER,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    is_billable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User quotas
CREATE TABLE IF NOT EXISTS user_quotas (
    quota_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    quota_type VARCHAR(50) NOT NULL,
    quota_limit INTEGER NOT NULL,
    current_usage INTEGER DEFAULT 0,
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quota_type)
);

-- Monthly usage summaries
CREATE TABLE IF NOT EXISTS monthly_usage_summaries (
    summary_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    emails_processed INTEGER DEFAULT 0,
    webhooks_called INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    total_charge DECIMAL(10,2) DEFAULT 0,
    overage_charges DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, billing_period_start)
);

-- Billing invoices
CREATE TABLE IF NOT EXISTS billing_invoices (
    invoice_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    invoice_number VARCHAR(20) NOT NULL UNIQUE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    invoice_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Producers
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
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_producer_email_instance UNIQUE (email, instance_id),
    CONSTRAINT check_status CHECK (status IN ('pending', 'approved', 'suspended', 'inactive'))
);

-- Producer sessions
CREATE TABLE IF NOT EXISTS producer_sessions (
    session_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL REFERENCES producers(producer_id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Producer submissions
CREATE TABLE IF NOT EXISTS producer_submissions (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL,
    producer_id INTEGER NOT NULL REFERENCES producers(producer_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Producer portal config
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_instance_config UNIQUE (instance_id)
);

-- Portal lines of business
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
    underwriter_location_guid VARCHAR(36)
);

-- Producer LOB access
CREATE TABLE IF NOT EXISTS producer_lob_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL REFERENCES producers(producer_id),
    lob_id INTEGER NOT NULL REFERENCES portal_lines_of_business(lob_id),
    can_quote BOOLEAN DEFAULT true,
    can_bind BOOLEAN DEFAULT false,
    commission_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(producer_id, lob_id)
);

-- Producer audit log
CREATE TABLE IF NOT EXISTS producer_audit_log (
    log_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL REFERENCES producers(producer_id),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Excel premium mappings
CREATE TABLE IF NOT EXISTS excel_premium_mappings (
    mapping_id SERIAL PRIMARY KEY,
    lob_id INTEGER NOT NULL REFERENCES portal_lines_of_business(lob_id),
    mapping_name VARCHAR(255) NOT NULL,
    cell_reference VARCHAR(50) NOT NULL,
    description TEXT,
    data_type VARCHAR(50) DEFAULT 'currency',
    formula_calc_method VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom routes
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
    lob_id INTEGER REFERENCES portal_lines_of_business(lob_id),
    min_fields_required INTEGER DEFAULT 0,
    max_submissions_per_day INTEGER DEFAULT 100,
    CONSTRAINT unique_instance_slug UNIQUE (instance_id, slug)
);

-- Custom route fields
CREATE TABLE IF NOT EXISTS custom_route_fields (
    field_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id) ON DELETE CASCADE,
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

-- Custom route submissions
CREATE TABLE IF NOT EXISTS custom_route_submissions (
    submission_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id),
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

-- Custom route workflow log
CREATE TABLE IF NOT EXISTS custom_route_workflow_log (
    log_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES custom_route_submissions(submission_id),
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

-- Custom route raters
CREATE TABLE IF NOT EXISTS custom_route_raters (
    rater_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id) ON DELETE CASCADE,
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

-- IMS configuration cache
CREATE TABLE IF NOT EXISTS ims_configuration_cache (
    cache_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    cache_key VARCHAR(255) NOT NULL,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instance_id, cache_key)
);

-- Custom webhooks
CREATE TABLE IF NOT EXISTS custom_webhooks (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER,
    instance_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    endpoint_path VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    url TEXT,
    method VARCHAR(10) DEFAULT 'POST',
    headers JSONB,
    auth_type VARCHAR(50) DEFAULT 'bearer',
    auth_config JSONB,
    auth_token VARCHAR(255),
    secret_key VARCHAR(255),
    retry_config JSONB,
    is_active BOOLEAN DEFAULT true,
    requires_auth BOOLEAN DEFAULT false,
    python_code TEXT,
    code_version INTEGER DEFAULT 1,
    allowed_ips TEXT[],
    ip_whitelist TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);

-- Webhook executions
CREATE TABLE IF NOT EXISTS webhook_executions (
    execution_id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL,
    trigger_type VARCHAR(100),
    trigger_id INTEGER,
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,
    execution_time_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook templates
CREATE TABLE IF NOT EXISTS webhook_templates (
    template_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    python_code TEXT NOT NULL,
    parameters JSONB,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);

-- IMS function mappings
CREATE TABLE IF NOT EXISTS ims_function_mappings (
    mapping_id SERIAL PRIMARY KEY,
    function_name VARCHAR(255) NOT NULL,
    function_type VARCHAR(50) NOT NULL,
    parameters JSONB,
    example_usage TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Form schemas
CREATE TABLE IF NOT EXISTS form_schemas (
    form_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id INTEGER NOT NULL,
    lob_id INTEGER REFERENCES portal_lines_of_business(lob_id),
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

-- Form submissions
CREATE TABLE IF NOT EXISTS form_submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES form_schemas(form_id),
    instance_id INTEGER,
    producer_id INTEGER REFERENCES producers(producer_id),
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

-- Form templates
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

-- IMS reports table (extra table found in test)
CREATE TABLE IF NOT EXISTS ims_reports (
    report_id SERIAL PRIMARY KEY,
    instance_id INTEGER,
    report_name VARCHAR(255),
    report_type VARCHAR(100),
    report_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);

-- Migrations tracking table (extra table found in test)
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- CREATE ALL INDEXES
-- ========================================================================

-- Email filing indexes
CREATE INDEX IF NOT EXISTS idx_email_filing_configs_user ON email_filing_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_configs_instance ON email_filing_configs(instance_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_config ON email_filing_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_status ON email_filing_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_control_number ON email_filing_logs(control_number_used);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_processed_at ON email_filing_logs(processed_at);
CREATE INDEX IF NOT EXISTS idx_attachments_log_id ON email_filing_attachments(log_id);

-- Email processing indexes
CREATE INDEX IF NOT EXISTS idx_email_processing_logs_instance ON email_processing_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_logs_status ON email_processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_processing_logs_created ON email_processing_logs(created_at);

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_quotas_user ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_monthly_usage_user ON monthly_usage_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_usage_period ON monthly_usage_summaries(billing_period_start);

-- Producer indexes
CREATE INDEX IF NOT EXISTS idx_producers_instance ON producers(instance_id);
CREATE INDEX IF NOT EXISTS idx_producers_status ON producers(status);
CREATE INDEX IF NOT EXISTS idx_producers_email ON producers(email);
CREATE INDEX IF NOT EXISTS idx_producer_sessions_token ON producer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_producer_sessions_expires ON producer_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_producer_submissions_producer ON producer_submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_producer_submissions_submission ON producer_submissions(submission_id);
CREATE INDEX IF NOT EXISTS idx_producer_audit_producer ON producer_audit_log(producer_id);
CREATE INDEX IF NOT EXISTS idx_producer_audit_created ON producer_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_producer_portal_config_instance ON producer_portal_config(instance_id);

-- Portal LOB indexes
CREATE INDEX IF NOT EXISTS idx_portal_lob_instance ON portal_lines_of_business(instance_id);
CREATE INDEX IF NOT EXISTS idx_portal_lob_active ON portal_lines_of_business(is_active);

-- Custom routes indexes
CREATE INDEX IF NOT EXISTS idx_custom_routes_instance ON custom_routes(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_routes_slug ON custom_routes(slug);
CREATE INDEX IF NOT EXISTS idx_custom_routes_active ON custom_routes(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_routes_category ON custom_routes(route_category);
CREATE INDEX IF NOT EXISTS idx_custom_routes_lob ON custom_routes(lob_id);
CREATE INDEX IF NOT EXISTS idx_custom_route_fields_route ON custom_route_fields(route_id);
CREATE INDEX IF NOT EXISTS idx_custom_route_fields_active ON custom_route_fields(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_route ON custom_route_submissions(route_id);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_instance ON custom_route_submissions(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_guid ON custom_route_submissions(submission_guid);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_uuid ON custom_route_submissions(submission_uuid);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_status ON custom_route_submissions(submission_status);
CREATE INDEX IF NOT EXISTS idx_workflow_log_submission ON custom_route_workflow_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_workflow_log_created ON custom_route_workflow_log(created_at);

-- Webhook indexes
CREATE INDEX IF NOT EXISTS idx_custom_webhooks_instance ON custom_webhooks(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_webhooks_active ON custom_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_executions_webhook ON webhook_executions(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_executions_created ON webhook_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_executions_status ON webhook_executions(status_code);

-- Form builder indexes
CREATE INDEX IF NOT EXISTS idx_form_schemas_instance ON form_schemas(instance_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_lob ON form_schemas(lob_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_active ON form_schemas(is_active);
CREATE INDEX IF NOT EXISTS idx_form_schemas_template ON form_schemas(is_template);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_producer ON form_submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_producer_submission ON form_submissions(producer_submission_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_draft ON form_submissions(is_draft);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_templates_instance ON form_templates(instance_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(category);
CREATE INDEX IF NOT EXISTS idx_form_templates_public ON form_templates(is_public);

-- ========================================================================
-- CREATE UPDATE TRIGGERS
-- ========================================================================

-- Generic updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at columns
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
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at 
            BEFORE UPDATE ON %I 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- ========================================================================
-- INSERT DEFAULT DATA (only if not exists)
-- ========================================================================

-- Default reserved subdomains
INSERT INTO reserved_subdomains (subdomain, reserved_reason)
VALUES 
    ('www', 'System reserved'),
    ('app', 'System reserved'),
    ('api', 'System reserved'),
    ('admin', 'System reserved'),
    ('mail', 'System reserved')
ON CONFLICT (subdomain) DO NOTHING;

-- Default subscription plans (if table is empty)
INSERT INTO subscription_plans (plan_name, monthly_price, yearly_price, emails_per_month, webhooks_per_month, api_calls_per_month, features)
SELECT 'starter', 29.99, 299.99, 1000, 5000, 10000, '{"max_users": 5, "support": "email", "retention_days": 30}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE plan_name = 'starter');

INSERT INTO subscription_plans (plan_name, monthly_price, yearly_price, emails_per_month, webhooks_per_month, api_calls_per_month, features)
SELECT 'professional', 99.99, 999.99, 10000, 50000, 100000, '{"max_users": 25, "support": "priority", "retention_days": 90, "custom_domain": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE plan_name = 'professional');

INSERT INTO subscription_plans (plan_name, monthly_price, yearly_price, emails_per_month, webhooks_per_month, api_calls_per_month, features)
SELECT 'enterprise', 299.99, 2999.99, -1, -1, -1, '{"max_users": -1, "support": "dedicated", "retention_days": 365, "custom_domain": true, "sso": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE plan_name = 'enterprise');

-- ========================================================================
-- UTILITY FUNCTIONS
-- ========================================================================

-- Get current billing period function
CREATE OR REPLACE FUNCTION get_current_billing_period(p_user_id INTEGER)
RETURNS TABLE(period_start DATE, period_end DATE) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_period_start,
        current_period_end
    FROM user_subscriptions
    WHERE user_id = p_user_id
    AND status IN ('active', 'trial')
    ORDER BY created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Record usage event function
CREATE OR REPLACE FUNCTION record_usage_event(
    p_user_id INTEGER,
    p_event_type VARCHAR(50),
    p_instance_id INTEGER DEFAULT NULL,
    p_event_data JSONB DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_quota_type VARCHAR(50);
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Insert the usage event
    INSERT INTO usage_events (user_id, instance_id, event_type, event_data)
    VALUES (p_user_id, p_instance_id, p_event_type, p_event_data);
    
    -- Map event type to quota type
    v_quota_type := CASE p_event_type
        WHEN 'email_processed' THEN 'emails'
        WHEN 'webhook_call' THEN 'webhooks'
        WHEN 'api_call' THEN 'api_calls'
        ELSE NULL
    END;
    
    -- Update quota if applicable
    IF v_quota_type IS NOT NULL THEN
        -- Get current billing period
        SELECT period_start, period_end INTO v_period_start, v_period_end
        FROM get_current_billing_period(p_user_id);
        
        -- Update or insert quota
        INSERT INTO user_quotas (user_id, quota_type, quota_limit, current_usage, current_period_start, current_period_end)
        VALUES (p_user_id, v_quota_type, 0, 1, v_period_start, v_period_end)
        ON CONFLICT (user_id, quota_type) 
        DO UPDATE SET 
            current_usage = user_quotas.current_usage + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_quotas.current_period_start = v_period_start;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- ADD ANY MISSING FOREIGN KEY RELATIONSHIPS
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
-- FINAL NOTES:
-- 1. This script creates ALL tables found in your test database
-- 2. All statements use IF NOT EXISTS for safety
-- 3. Run this in production to ensure schema matches test
-- 4. You may want to consolidate 'Users' and 'users' tables
-- 5. Monitor for any errors during execution
-- ========================================================================

-- ========================================================================
-- MIGRATION 020: Excel Premium Mappings
-- ========================================================================

-- Create table for Excel premium cell mappings per Line of Business
CREATE TABLE IF NOT EXISTS excel_premium_mappings (
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

-- Add some common default mappings (can be overridden per LOB)
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

-- Add column to track if LOB uses formula calculation
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS excel_formula_calculation BOOLEAN DEFAULT TRUE;

-- Add column to track calculation method preference
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS formula_calc_method VARCHAR(20) DEFAULT 'xlsx-calc' 
    CHECK (formula_calc_method IN ('xlsx-calc', 'python', 'none'));

COMMENT ON TABLE excel_premium_mappings IS 'Stores Excel cell mappings for premium extraction per Line of Business';
COMMENT ON COLUMN excel_premium_mappings.mapping_type IS 'Type of value in cell: premium, fee, tax, etc.';
COMMENT ON COLUMN excel_premium_mappings.priority IS 'Order to check cells when looking for values (1 = check first)';
COMMENT ON COLUMN portal_lines_of_business.excel_formula_calculation IS 'Whether to calculate Excel formulas before IMS import';
COMMENT ON COLUMN portal_lines_of_business.formula_calc_method IS 'Method to use for formula calculation: xlsx-calc, python, or none';

-- ========================================================================
-- MIGRATION 021: Update Formula Calc Methods
-- ========================================================================
-- Migration: Update formula calculation method constraint to include new options
-- Date: 2025-01-14
-- Description: Add excel_com and libreoffice as valid formula calculation methods

-- First, drop the existing constraint
ALTER TABLE portal_lines_of_business 
DROP CONSTRAINT IF EXISTS portal_lines_of_business_formula_calc_method_check;

-- Add the updated constraint with all 4 methods
ALTER TABLE portal_lines_of_business 
ADD CONSTRAINT portal_lines_of_business_formula_calc_method_check 
CHECK (formula_calc_method IN ('none', 'python', 'excel_com', 'libreoffice', 'xlsx-calc'));

-- Update any existing 'xlsx-calc' values to 'none' since xlsx-calc corrupts files
UPDATE portal_lines_of_business 
SET formula_calc_method = 'none' 
WHERE formula_calc_method = 'xlsx-calc';

-- Add comments
COMMENT ON COLUMN portal_lines_of_business.formula_calc_method IS 
'Excel formula calculation method: none (no calculation), python (openpyxl), excel_com (Windows Excel COM), libreoffice (LibreOffice headless)';
