-- Form Builder Migration Script
-- Run this directly in pgAdmin or psql on Windows
-- Database: IMS_Application

-- Check current tables
SELECT 'Current form-related tables:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'form%'
ORDER BY table_name;

-- Run the migration
\echo 'Running form builder migration...'
\i migrations/20240107_add_form_schemas.sql

-- Verify tables were created
SELECT 'After migration - form-related tables:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('form_schemas', 'form_submissions', 'form_templates')
ORDER BY table_name;

-- Check if form_schema_id was added to portal_lines_of_business
SELECT 'Checking form_schema_id column:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'portal_lines_of_business' 
AND column_name = 'form_schema_id';

\echo 'Migration complete!'