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