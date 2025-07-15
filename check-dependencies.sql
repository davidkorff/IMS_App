-- Check for any dependencies on the columns and table we're about to drop

-- Check for views that might reference these columns
SELECT DISTINCT 
    v.viewname,
    v.definition
FROM pg_views v
WHERE v.definition ILIKE '%excel_premium_mappings%'
   OR v.definition ILIKE '%excel_formula_calculation%'
   OR v.definition ILIKE '%formula_calc_method%';

-- Check for foreign key constraints referencing excel_premium_mappings
SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'excel_premium_mappings';

-- Check for any functions/procedures that might reference these
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE pg_get_functiondef(p.oid) ILIKE '%excel_premium_mappings%'
   OR pg_get_functiondef(p.oid) ILIKE '%excel_formula_calculation%'
   OR pg_get_functiondef(p.oid) ILIKE '%formula_calc_method%';

-- Check for triggers that might reference these
SELECT 
    event_object_table as table_name,
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE action_statement ILIKE '%excel_premium_mappings%'
   OR action_statement ILIKE '%excel_formula_calculation%'
   OR action_statement ILIKE '%formula_calc_method%';

-- Check if these columns are used in any indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef ILIKE '%excel_formula_calculation%'
   OR indexdef ILIKE '%formula_calc_method%'
   OR tablename = 'excel_premium_mappings';

-- Final safety check: Count any data in excel_premium_mappings
SELECT 
    'excel_premium_mappings row count' as check_type,
    COUNT(*) as count
FROM excel_premium_mappings;