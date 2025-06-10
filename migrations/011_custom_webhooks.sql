-- Custom Webhooks System
-- This migration creates tables for custom webhook integrations

-- Table for storing webhook configurations
CREATE TABLE IF NOT EXISTS custom_webhooks (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES ims_instances(instance_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    endpoint_path VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    requires_auth BOOLEAN DEFAULT false,
    auth_type VARCHAR(50) DEFAULT 'bearer', -- bearer, hmac, basic
    auth_token VARCHAR(255),
    secret_key VARCHAR(255), -- for HMAC signing
    allowed_ips TEXT[], -- IP whitelist
    python_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id),
    UNIQUE(instance_id, endpoint_path)
);

-- Table for webhook execution logs
CREATE TABLE IF NOT EXISTS webhook_executions (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES custom_webhooks(id) ON DELETE CASCADE,
    request_id VARCHAR(255) UNIQUE NOT NULL,
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    execution_time_ms INTEGER,
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

-- Table for webhook templates/snippets
CREATE TABLE IF NOT EXISTS webhook_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    python_code TEXT NOT NULL,
    parameters JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT true
);

-- Table for IMS function mappings
CREATE TABLE IF NOT EXISTS ims_function_mappings (
    id SERIAL PRIMARY KEY,
    function_category VARCHAR(100) NOT NULL,
    function_name VARCHAR(255) NOT NULL,
    python_function_name VARCHAR(255) NOT NULL,
    description TEXT,
    parameters JSONB,
    return_type VARCHAR(100),
    example_code TEXT,
    documentation_path VARCHAR(255)
);

-- Indexes for performance
CREATE INDEX idx_custom_webhooks_instance_id ON custom_webhooks(instance_id);
CREATE INDEX idx_custom_webhooks_endpoint_path ON custom_webhooks(endpoint_path);
CREATE INDEX idx_webhook_executions_webhook_id ON webhook_executions(webhook_id);
CREATE INDEX idx_webhook_executions_executed_at ON webhook_executions(executed_at);
CREATE INDEX idx_webhook_templates_category ON webhook_templates(category);

-- Insert some default templates
INSERT INTO webhook_templates (name, category, description, python_code, parameters) VALUES
('Basic JSON Handler', 'basic', 'Simple handler that logs incoming JSON data', 
'def handle_webhook(data, context):
    """
    Basic webhook handler that logs incoming data
    
    Args:
        data: The incoming webhook data (dict)
        context: Webhook context including headers, instance info
    
    Returns:
        dict: Response to send back to webhook caller
    """
    print(f"Received data: {data}")
    return {"status": "success", "message": "Data received"}', 
'{}'),

('Create Insured', 'insured', 'Creates a new insured in IMS from webhook data',
'def handle_webhook(data, context):
    """
    Creates a new insured from webhook data
    
    Expected data format:
    {
        "name": "Company Name",
        "contact": {
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com"
        }
    }
    """
    from ims_functions import add_insured_with_contact
    
    result = add_insured_with_contact(
        insured_name=data.get("name"),
        contact_data=data.get("contact", {})
    )
    
    return {"status": "success", "insured_guid": result.get("guid")}',
'{"name": "string", "contact": "object"}'),

('Create Quote', 'quote', 'Creates a new quote from webhook data',
'def handle_webhook(data, context):
    """
    Creates a new quote from webhook data
    
    Expected data format:
    {
        "insured_guid": "xxx-xxx-xxx",
        "producer_guid": "xxx-xxx-xxx",
        "line_of_business": "GL",
        "effective_date": "2024-01-01"
    }
    """
    from ims_functions import add_quote_with_insured
    
    result = add_quote_with_insured(
        insured_guid=data.get("insured_guid"),
        producer_guid=data.get("producer_guid"),
        line_of_business=data.get("line_of_business"),
        effective_date=data.get("effective_date")
    )
    
    return {"status": "success", "quote_guid": result.get("guid")}',
'{"insured_guid": "string", "producer_guid": "string", "line_of_business": "string", "effective_date": "date"}');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_custom_webhooks_updated_at BEFORE UPDATE ON custom_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();