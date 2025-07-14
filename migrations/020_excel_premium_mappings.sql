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