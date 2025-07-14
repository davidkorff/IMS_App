-- Add missing IMS fields to portal_lines_of_business table
-- These fields are needed for proper IMS integration

-- Add ims_company_guid if it doesn't exist
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_company_guid VARCHAR(36);

-- Add ims_procedure_id for rater procedures
ALTER TABLE portal_lines_of_business 
ADD COLUMN IF NOT EXISTS ims_procedure_id INTEGER;

-- Add comments to clarify field usage
COMMENT ON COLUMN portal_lines_of_business.ims_line_guid IS 'GUID of the IMS line (from lstLines)';
COMMENT ON COLUMN portal_lines_of_business.ims_company_guid IS 'GUID of the IMS company (from tblCompanyLocations)';
COMMENT ON COLUMN portal_lines_of_business.ims_procedure_id IS 'IMS procedure ID for rating';