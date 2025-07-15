-- Drop the excel_premium_mappings table and related columns
-- This table was used for extracting premiums from Excel files but is no longer needed
-- as premiums are now obtained from IMS stored procedures

-- Drop the excel_premium_mappings table
DROP TABLE IF EXISTS excel_premium_mappings;

-- Remove related columns from portal_lines_of_business if they exist
ALTER TABLE portal_lines_of_business 
DROP COLUMN IF EXISTS excel_formula_calculation;

ALTER TABLE portal_lines_of_business 
DROP COLUMN IF EXISTS formula_calc_method;

-- Log the cleanup
DO $$
BEGIN
    RAISE NOTICE 'Removed excel_premium_mappings table and related columns';
    RAISE NOTICE 'Premium extraction is now handled entirely by IMS stored procedures';
END $$;