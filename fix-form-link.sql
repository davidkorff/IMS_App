-- Fix the form builder loading issue by properly linking the form to the LOB

-- First, check what we have
SELECT 
    'Current LOB Status:' as info,
    lob_id,
    line_name,
    form_schema_id
FROM portal_lines_of_business 
WHERE lob_id = 4;

-- Check if there's a form schema for this LOB
SELECT 
    'Available Form Schemas:' as info,
    form_id,
    title,
    lob_id,
    created_at
FROM form_schemas 
WHERE lob_id = 4 AND instance_id = 4
ORDER BY created_at DESC;

-- Update the LOB to link to the most recent form schema
UPDATE portal_lines_of_business 
SET form_schema_id = (
    SELECT form_id 
    FROM form_schemas 
    WHERE lob_id = 4 AND instance_id = 4 
    ORDER BY created_at DESC 
    LIMIT 1
),
updated_at = CURRENT_TIMESTAMP
WHERE lob_id = 4;

-- Verify the update
SELECT 
    'After Update:' as info,
    l.lob_id,
    l.line_name,
    l.form_schema_id,
    f.title as form_title
FROM portal_lines_of_business l
LEFT JOIN form_schemas f ON l.form_schema_id = f.form_id
WHERE l.lob_id = 4;