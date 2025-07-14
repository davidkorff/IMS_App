-- ========================================================================
-- VERIFY PRODUCTION SCHEMA
-- ========================================================================

-- 1. Count total tables
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 2. List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. Check key tables exist
SELECT 
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'producers') as has_producers,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_lines_of_business') as has_lob,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_routes') as has_routes,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_route_submissions') as has_submissions,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'excel_premium_mappings') as has_excel_mappings,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') as has_permissions,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'form_schemas') as has_form_schemas,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'form_submissions') as has_form_submissions;

-- 4. Check the problematic status column exists
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'custom_route_submissions' 
AND column_name IN ('status', 'submission_status')
ORDER BY column_name;

-- 5. Check formula_calc_method column in portal_lines_of_business
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'portal_lines_of_business' 
AND column_name IN ('formula_calc_method', 'excel_formula_calculation')
ORDER BY column_name;

-- 6. Count rows in key tables (should be 0 for new tables)
SELECT 
    'producers' as table_name, COUNT(*) as row_count FROM producers
UNION ALL
SELECT 'portal_lines_of_business', COUNT(*) FROM portal_lines_of_business
UNION ALL
SELECT 'custom_routes', COUNT(*) FROM custom_routes
UNION ALL
SELECT 'custom_route_submissions', COUNT(*) FROM custom_route_submissions
UNION ALL
SELECT 'excel_premium_mappings', COUNT(*) FROM excel_premium_mappings
ORDER BY table_name;