-- Add IMS integration fields to portal_lines_of_business table
-- These fields will link LOBs to specific IMS companies and procedures/forms

-- Add company GUID field
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'portal_lines_of_business' 
        AND column_name = 'ims_company_guid'
    ) THEN
        ALTER TABLE portal_lines_of_business 
        ADD COLUMN ims_company_guid VARCHAR(36) NULL;
    END IF;
END $$;

-- Add procedure/form ID field
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'portal_lines_of_business' 
        AND column_name = 'ims_procedure_id'
    ) THEN
        ALTER TABLE portal_lines_of_business 
        ADD COLUMN ims_procedure_id INT NULL;
    END IF;
END $$;

-- Add procedure name for display purposes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'portal_lines_of_business' 
        AND column_name = 'ims_procedure_name'
    ) THEN
        ALTER TABLE portal_lines_of_business 
        ADD COLUMN ims_procedure_name VARCHAR(255) NULL;
    END IF;
END $$;

-- Add form configuration JSON to store field mappings and settings
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'portal_lines_of_business' 
        AND column_name = 'form_config'
    ) THEN
        ALTER TABLE portal_lines_of_business 
        ADD COLUMN form_config TEXT NULL;
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_portal_lob_company_guid ON portal_lines_of_business(ims_company_guid);
CREATE INDEX IF NOT EXISTS idx_portal_lob_procedure_id ON portal_lines_of_business(ims_procedure_id);