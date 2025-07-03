-- Add IMS integration fields to portal_lines_of_business table
-- These fields will link LOBs to specific IMS companies and procedures/forms

-- Add company GUID field
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'portal_lines_of_business' 
    AND COLUMN_NAME = 'ims_company_guid'
)
BEGIN
    ALTER TABLE portal_lines_of_business 
    ADD ims_company_guid VARCHAR(36) NULL;
END;

-- Add procedure/form ID field
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'portal_lines_of_business' 
    AND COLUMN_NAME = 'ims_procedure_id'
)
BEGIN
    ALTER TABLE portal_lines_of_business 
    ADD ims_procedure_id INT NULL;
END;

-- Add procedure name for display purposes
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'portal_lines_of_business' 
    AND COLUMN_NAME = 'ims_procedure_name'
)
BEGIN
    ALTER TABLE portal_lines_of_business 
    ADD ims_procedure_name NVARCHAR(255) NULL;
END;

-- Add form configuration JSON to store field mappings and settings
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'portal_lines_of_business' 
    AND COLUMN_NAME = 'form_config'
)
BEGIN
    ALTER TABLE portal_lines_of_business 
    ADD form_config TEXT NULL;
END;

-- Add indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_portal_lob_company_guid')
BEGIN
    CREATE INDEX idx_portal_lob_company_guid ON portal_lines_of_business(ims_company_guid);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_portal_lob_procedure_id')
BEGIN
    CREATE INDEX idx_portal_lob_procedure_id ON portal_lines_of_business(ims_procedure_id);
END;