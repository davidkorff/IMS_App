-- ========================================================================
-- CONSOLIDATED PRODUCTION MIGRATION SCRIPT
-- ========================================================================
-- This script contains all actively used tables from the codebase analysis.
-- All statements use IF EXISTS checks for production safety.
-- Tables are organized by functional area.
-- ========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- SECTION 1: EMAIL PROCESSING & FILING SYSTEM
-- ========================================================================

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

CREATE INDEX IF NOT EXISTS idx_email_filing_configs_user ON email_filing_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_configs_instance ON email_filing_configs(instance_id);

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

CREATE INDEX IF NOT EXISTS idx_email_filing_logs_config ON email_filing_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_status ON email_filing_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_control_number ON email_filing_logs(control_number_used);
CREATE INDEX IF NOT EXISTS idx_email_filing_logs_processed_at ON email_filing_logs(processed_at);

-- Email configurations
CREATE TABLE IF NOT EXISTS email_configurations (
    instance_id INTEGER PRIMARY KEY,
    config_type VARCHAR(50) NOT NULL DEFAULT 'graph',
    email_address VARCHAR(255),
    email_prefix VARCHAR(50),
    email_system_type VARCHAR(50) DEFAULT 'graph',
    auto_extract_control_numbers BOOLEAN DEFAULT false,
    control_number_patterns JSONB,
    include_attachments BOOLEAN DEFAULT true,
    default_folder_id VARCHAR(36),
    test_status VARCHAR(50) DEFAULT 'not_tested',
    last_processed_timestamp TIMESTAMP,
    graph_client_id_encrypted BYTEA,
    graph_client_secret_encrypted BYTEA,
    graph_tenant_id_encrypted BYTEA,
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

CREATE INDEX IF NOT EXISTS idx_email_processing_logs_instance ON email_processing_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_logs_status ON email_processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_processing_logs_created ON email_processing_logs(created_at);

-- Reserved subdomains
CREATE TABLE IF NOT EXISTS reserved_subdomains (
    subdomain VARCHAR(50) PRIMARY KEY,
    reserved_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default reserved subdomains
INSERT INTO reserved_subdomains (subdomain, reserved_reason)
VALUES 
    ('www', 'System reserved'),
    ('app', 'System reserved'),
    ('api', 'System reserved'),
    ('admin', 'System reserved'),
    ('mail', 'System reserved'),
    ('email', 'System reserved'),
    ('support', 'System reserved'),
    ('help', 'System reserved'),
    ('docs', 'System reserved'),
    ('blog', 'System reserved')
ON CONFLICT (subdomain) DO NOTHING;

-- ========================================================================
-- SECTION 2: USAGE TRACKING & BILLING
-- ========================================================================

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

-- Insert default plans
INSERT INTO subscription_plans (plan_name, monthly_price, yearly_price, emails_per_month, webhooks_per_month, api_calls_per_month, features)
VALUES 
    ('starter', 29.99, 299.99, 1000, 5000, 10000, '{"max_users": 5, "support": "email", "retention_days": 30}'::jsonb),
    ('professional', 99.99, 999.99, 10000, 50000, 100000, '{"max_users": 25, "support": "priority", "retention_days": 90, "custom_domain": true}'::jsonb),
    ('enterprise', 299.99, 2999.99, -1, -1, -1, '{"max_users": -1, "support": "dedicated", "retention_days": 365, "custom_domain": true, "sso": true}'::jsonb)
ON CONFLICT (plan_name) DO NOTHING;

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

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

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

CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);

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

CREATE INDEX IF NOT EXISTS idx_user_quotas_user ON user_quotas(user_id);

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

CREATE INDEX IF NOT EXISTS idx_monthly_usage_user ON monthly_usage_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_usage_period ON monthly_usage_summaries(billing_period_start);

-- ========================================================================
-- SECTION 3: PRODUCER PORTAL
-- ========================================================================

-- Producers
CREATE TABLE IF NOT EXISTS producers (
    producer_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    company_name VARCHAR(255),
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

CREATE INDEX IF NOT EXISTS idx_producers_instance ON producers(instance_id);
CREATE INDEX IF NOT EXISTS idx_producers_status ON producers(status);
CREATE INDEX IF NOT EXISTS idx_producers_email ON producers(email);

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

CREATE INDEX IF NOT EXISTS idx_producer_sessions_token ON producer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_producer_sessions_expires ON producer_sessions(expires_at);

-- Producer submissions link table
CREATE TABLE IF NOT EXISTS producer_submissions (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL,
    producer_id INTEGER NOT NULL REFERENCES producers(producer_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_producer_submissions_producer ON producer_submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_producer_submissions_submission ON producer_submissions(submission_id);

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

CREATE INDEX IF NOT EXISTS idx_portal_lob_instance ON portal_lines_of_business(instance_id);
CREATE INDEX IF NOT EXISTS idx_portal_lob_active ON portal_lines_of_business(is_active);

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

-- Producer route access
CREATE TABLE IF NOT EXISTS producer_route_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL REFERENCES producers(producer_id),
    route_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    UNIQUE(producer_id, route_id)
);

-- ========================================================================
-- SECTION 4: CUSTOM ROUTES & FORMS
-- ========================================================================

-- Custom routes
CREATE TABLE IF NOT EXISTS custom_routes (
    route_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,
    route_type VARCHAR(50) DEFAULT 'form',
    form_config JSONB,
    workflow_config JSONB,
    ims_config JSONB,
    rater_config JSONB,
    settings JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    route_category VARCHAR(50) DEFAULT 'general',
    producer_access_level VARCHAR(50) DEFAULT 'all',
    lob_id INTEGER REFERENCES portal_lines_of_business(lob_id),
    min_fields_required INTEGER DEFAULT 0,
    max_submissions_per_day INTEGER DEFAULT 100,
    CONSTRAINT unique_instance_slug UNIQUE (instance_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_custom_routes_instance ON custom_routes(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_routes_slug ON custom_routes(slug);
CREATE INDEX IF NOT EXISTS idx_custom_routes_active ON custom_routes(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_routes_category ON custom_routes(route_category);
CREATE INDEX IF NOT EXISTS idx_custom_routes_lob ON custom_routes(lob_id);

-- Custom route fields
CREATE TABLE IF NOT EXISTS custom_route_fields (
    field_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    field_label VARCHAR(255),
    field_config JSONB,
    validation_rules JSONB,
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    step_number INTEGER DEFAULT 1,
    field_order INTEGER DEFAULT 0,
    ims_field_mapping VARCHAR(255),
    rater_field_mapping VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_route_fields_route ON custom_route_fields(route_id);
CREATE INDEX IF NOT EXISTS idx_custom_route_fields_active ON custom_route_fields(is_active);

-- Custom route submissions
CREATE TABLE IF NOT EXISTS custom_route_submissions (
    submission_id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES custom_routes(route_id),
    instance_id INTEGER NOT NULL,
    submission_guid UUID DEFAULT gen_random_uuid(),
    form_data JSONB NOT NULL,
    submission_status VARCHAR(50) DEFAULT 'pending',
    workflow_status JSONB,
    ims_quote_guid VARCHAR(36),
    ims_policy_guid VARCHAR(36),
    ims_policy_number VARCHAR(50),
    rater_premium DECIMAL(10,2),
    rater_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_submissions_route ON custom_route_submissions(route_id);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_instance ON custom_route_submissions(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_guid ON custom_route_submissions(submission_guid);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_status ON custom_route_submissions(submission_status);

-- Custom route workflow log
CREATE TABLE IF NOT EXISTS custom_route_workflow_log (
    log_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES custom_route_submissions(submission_id),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    details JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_log_submission ON custom_route_workflow_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_workflow_log_created ON custom_route_workflow_log(created_at);

-- ========================================================================
-- SECTION 5: FORM BUILDER
-- ========================================================================

-- Form schemas
CREATE TABLE IF NOT EXISTS form_schemas (
    form_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id INTEGER NOT NULL,
    lob_id INTEGER REFERENCES portal_lines_of_business(lob_id),
    form_name VARCHAR(255) NOT NULL,
    form_config JSONB NOT NULL,
    field_mappings JSONB,
    validation_rules JSONB,
    schema_version VARCHAR(10) DEFAULT '1.0',
    title VARCHAR(255),
    description TEXT,
    form_schema JSONB,
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_form_schemas_instance ON form_schemas(instance_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_lob ON form_schemas(lob_id);
CREATE INDEX IF NOT EXISTS idx_form_schemas_active ON form_schemas(is_active);
CREATE INDEX IF NOT EXISTS idx_form_schemas_template ON form_schemas(is_template);

-- Form submissions
CREATE TABLE IF NOT EXISTS form_submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES form_schemas(form_id),
    instance_id INTEGER,
    submission_data JSONB NOT NULL,
    producer_id INTEGER REFERENCES producers(producer_id),
    producer_submission_id INTEGER,
    form_data JSONB,
    form_state JSONB,
    is_draft BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_producer ON form_submissions(producer_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_producer_submission ON form_submissions(producer_submission_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_draft ON form_submissions(is_draft);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);

-- ========================================================================
-- SECTION 6: WEBHOOKS
-- ========================================================================

-- Custom webhooks
CREATE TABLE IF NOT EXISTS custom_webhooks (
    webhook_id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'POST',
    headers JSONB,
    auth_type VARCHAR(50),
    auth_config JSONB,
    retry_config JSONB,
    is_active BOOLEAN DEFAULT true,
    python_code TEXT,
    code_version INTEGER DEFAULT 1,
    ip_whitelist TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_webhooks_instance ON custom_webhooks(instance_id);
CREATE INDEX IF NOT EXISTS idx_custom_webhooks_active ON custom_webhooks(is_active);

-- Webhook executions
CREATE TABLE IF NOT EXISTS webhook_executions (
    execution_id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES custom_webhooks(webhook_id),
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

CREATE INDEX IF NOT EXISTS idx_webhook_executions_webhook ON webhook_executions(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_executions_created ON webhook_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_executions_status ON webhook_executions(status_code);

-- ========================================================================
-- SECTION 7: UPDATE FUNCTIONS & TRIGGERS
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
        'email_filing_configs',
        'email_configurations',
        'subscription_plans',
        'user_subscriptions',
        'user_quotas',
        'producers',
        'portal_lines_of_business',
        'custom_routes',
        'custom_route_fields',
        'custom_route_submissions',
        'form_schemas',
        'form_submissions',
        'custom_webhooks'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at 
            BEFORE UPDATE ON %I 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl);
    END LOOP;
END;
$$;

-- ========================================================================
-- SECTION 8: UTILITY FUNCTIONS
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
-- SECTION 9: GRANT PERMISSIONS (Adjust based on your database users)
-- ========================================================================

-- Example grants (uncomment and adjust as needed):
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

-- ========================================================================
-- END OF MIGRATION
-- ========================================================================