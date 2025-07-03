-- Extend custom_routes table for producer portal integration
ALTER TABLE custom_routes 
ADD COLUMN route_category VARCHAR(50) DEFAULT 'general',
ADD COLUMN producer_access_level VARCHAR(50) DEFAULT 'all', -- all, approved, specific
ADD COLUMN rater_config TEXT, -- JSON for rater field mappings
ADD COLUMN lob_id INTEGER,
ADD CONSTRAINT fk_custom_routes_lob FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id);

-- Add index for better query performance
CREATE INDEX idx_custom_routes_lob ON custom_routes(lob_id);
CREATE INDEX idx_custom_routes_category ON custom_routes(route_category);

-- Producer access control table for specific access
CREATE TABLE producer_route_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    UNIQUE(producer_id, route_id),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES custom_routes(route_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id)
);

-- Producer LOB access table
CREATE TABLE producer_lob_access (
    access_id SERIAL PRIMARY KEY,
    producer_id INTEGER NOT NULL,
    lob_id INTEGER NOT NULL,
    can_quote BOOLEAN DEFAULT true,
    can_bind BOOLEAN DEFAULT false,
    commission_rate DECIMAL(5,2),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(producer_id, lob_id),
    FOREIGN KEY (producer_id) REFERENCES producers(producer_id) ON DELETE CASCADE,
    FOREIGN KEY (lob_id) REFERENCES portal_lines_of_business(lob_id) ON DELETE CASCADE
);

-- Update existing routes to have default category
UPDATE custom_routes SET route_category = 'general' WHERE route_category IS NULL;

-- Add sample comments for documentation
COMMENT ON COLUMN custom_routes.route_category IS 'Category: general, producer-only, internal';
COMMENT ON COLUMN custom_routes.producer_access_level IS 'Access level: all (any producer), approved (approved producers only), specific (use producer_route_access table)';
COMMENT ON COLUMN custom_routes.rater_config IS 'JSON configuration for Excel rater field mappings';