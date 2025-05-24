-- Billing and Usage Tracking System
-- Creates tables for subscription management and usage tracking

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(50) NOT NULL UNIQUE,
    plan_display_name VARCHAR(100) NOT NULL,
    monthly_price DECIMAL(10,2) NOT NULL,
    max_instances INTEGER,
    monthly_email_limit INTEGER,
    overage_price_per_email DECIMAL(10,4) NOT NULL DEFAULT 0.06,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(plan_id),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, cancelled, trial
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking for billing
CREATE TABLE IF NOT EXISTS usage_events (
    event_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    instance_id INTEGER REFERENCES ims_instances(instance_id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'email_processed', 'email_filed', 'webhook_call', 'api_call'
    event_subtype VARCHAR(50), -- 'success', 'failure', 'manual', 'automated'
    quantity INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    billable BOOLEAN DEFAULT true,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for billing queries
    INDEX idx_usage_events_user_period (user_id, billing_period_start, billing_period_end),
    INDEX idx_usage_events_type (event_type, billable),
    INDEX idx_usage_events_created (created_at)
);

-- Monthly usage summaries for billing
CREATE TABLE IF NOT EXISTS monthly_usage_summaries (
    summary_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    billing_month DATE NOT NULL, -- First day of the billing month
    plan_id INTEGER REFERENCES subscription_plans(plan_id),
    
    -- Core metrics
    emails_processed INTEGER DEFAULT 0,
    emails_filed_successfully INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    webhook_calls INTEGER DEFAULT 0,
    manual_filings INTEGER DEFAULT 0,
    
    -- Billing calculations
    included_emails INTEGER DEFAULT 0,
    overage_emails INTEGER DEFAULT 0,
    base_charge DECIMAL(10,2) DEFAULT 0,
    overage_charge DECIMAL(10,2) DEFAULT 0,
    total_charge DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    is_final BOOLEAN DEFAULT false,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, billing_month)
);

-- Billing invoices
CREATE TABLE IF NOT EXISTS billing_invoices (
    invoice_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    invoice_number VARCHAR(20) NOT NULL UNIQUE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Invoice details
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, cancelled
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    invoice_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_invoices_user (user_id),
    INDEX idx_invoices_status (status),
    INDEX idx_invoices_due_date (due_date)
);

-- Usage quota tracking (for real-time limit enforcement)
CREATE TABLE IF NOT EXISTS user_quotas (
    quota_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL, -- 'monthly_emails', 'instances', 'api_calls'
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    
    -- Limits and usage
    quota_limit INTEGER,
    current_usage INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, quota_type, current_period_start),
    INDEX idx_quotas_user_type (user_id, quota_type)
);

-- Insert default subscription plans
INSERT INTO subscription_plans (plan_name, plan_display_name, monthly_price, max_instances, monthly_email_limit, overage_price_per_email, features) VALUES 
('starter', 'Starter', 49.00, 1, 500, 0.06, '{"support": "basic", "patterns": "standard"}'),
('professional', 'Professional', 149.00, 3, 2500, 0.06, '{"support": "priority", "patterns": "custom", "reporting": "advanced"}'),
('enterprise', 'Enterprise', 399.00, NULL, 10000, 0.06, '{"support": "dedicated", "patterns": "custom", "reporting": "advanced", "api_access": true, "white_label": true}')
ON CONFLICT (plan_name) DO NOTHING;

-- Function to get current billing period for a user
CREATE OR REPLACE FUNCTION get_current_billing_period(user_id_param INTEGER)
RETURNS TABLE(period_start DATE, period_end DATE) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.current_period_start::DATE,
        us.current_period_end::DATE
    FROM user_subscriptions us
    WHERE us.user_id = user_id_param 
      AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to record usage event
CREATE OR REPLACE FUNCTION record_usage_event(
    user_id_param INTEGER,
    instance_id_param INTEGER,
    event_type_param VARCHAR(50),
    event_subtype_param VARCHAR(50) DEFAULT NULL,
    quantity_param INTEGER DEFAULT 1,
    metadata_param JSONB DEFAULT '{}'
) RETURNS INTEGER AS $$
DECLARE
    billing_start DATE;
    billing_end DATE;
    event_id INTEGER;
BEGIN
    -- Get current billing period
    SELECT period_start, period_end INTO billing_start, billing_end
    FROM get_current_billing_period(user_id_param);
    
    -- If no active subscription, use current month
    IF billing_start IS NULL THEN
        billing_start := DATE_TRUNC('month', CURRENT_DATE);
        billing_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    END IF;
    
    -- Insert usage event
    INSERT INTO usage_events (
        user_id, instance_id, event_type, event_subtype, quantity, metadata,
        billing_period_start, billing_period_end
    ) VALUES (
        user_id_param, instance_id_param, event_type_param, event_subtype_param, 
        quantity_param, metadata_param, billing_start, billing_end
    ) RETURNING usage_events.event_id INTO event_id;
    
    -- Update quota usage
    INSERT INTO user_quotas (user_id, quota_type, current_period_start, current_period_end, current_usage)
    VALUES (user_id_param, event_type_param, billing_start, billing_end, quantity_param)
    ON CONFLICT (user_id, quota_type, current_period_start)
    DO UPDATE SET current_usage = user_quotas.current_usage + quantity_param;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period ON user_subscriptions (current_period_start, current_period_end);

-- Update trigger for user_subscriptions
CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_subscriptions_updated_at();

-- Comments for documentation
COMMENT ON TABLE subscription_plans IS 'Available subscription plans with pricing and limits';
COMMENT ON TABLE user_subscriptions IS 'User subscription status and billing periods';
COMMENT ON TABLE usage_events IS 'Individual usage events for billing tracking';
COMMENT ON TABLE monthly_usage_summaries IS 'Aggregated monthly usage for billing';
COMMENT ON TABLE billing_invoices IS 'Generated invoices for customers';
COMMENT ON TABLE user_quotas IS 'Real-time quota tracking for usage limits';
COMMENT ON FUNCTION record_usage_event IS 'Records a usage event and updates quotas';
COMMENT ON FUNCTION get_current_billing_period IS 'Gets current billing period for a user';