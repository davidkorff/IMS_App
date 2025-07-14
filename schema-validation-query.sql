-- ========================================================================
-- COMPREHENSIVE DATABASE SCHEMA VALIDATION QUERY
-- ========================================================================
-- This query extracts the complete database schema including:
-- - Tables with row counts
-- - Columns with data types and constraints
-- - Indexes
-- - Foreign keys
-- - Functions and triggers
-- ========================================================================

-- Set output format for better readability
\pset format aligned
\pset border 2

-- 1. DATABASE SUMMARY
SELECT 
    '=== DATABASE SUMMARY ===' as section,
    current_database() as database_name,
    version() as postgres_version,
    pg_database_size(current_database())/1024/1024 as size_mb,
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as table_count,
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public') as column_count,
    (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as index_count;

-- 2. ALL TABLES WITH ROW COUNTS
SELECT 
    '=== TABLES WITH ROW COUNTS ===' as section;

SELECT 
    t.table_name,
    obj_description(c.oid) as table_comment,
    (xpath('/row/cnt/text()', 
           query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', t.table_schema, t.table_name), 
           false, true, '')))[1]::text::int AS row_count,
    pg_size_pretty(pg_relation_size(c.oid)) as table_size
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
WHERE t.table_schema = 'public' 
AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- 3. DETAILED COLUMN INFORMATION FOR EACH TABLE
SELECT 
    '=== DETAILED SCHEMA FOR EACH TABLE ===' as section;

WITH table_columns AS (
    SELECT 
        c.table_name,
        c.ordinal_position,
        c.column_name,
        c.data_type,
        CASE 
            WHEN c.character_maximum_length IS NOT NULL 
            THEN c.data_type || '(' || c.character_maximum_length || ')'
            WHEN c.numeric_precision IS NOT NULL 
            THEN c.data_type || '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
            ELSE c.data_type
        END AS full_data_type,
        c.is_nullable,
        c.column_default,
        CASE 
            WHEN pk.constraint_name IS NOT NULL THEN 'PK'
            WHEN fk.constraint_name IS NOT NULL THEN 'FK -> ' || fk.foreign_table_name || '(' || fk.foreign_column_name || ')'
            WHEN uk.constraint_name IS NOT NULL THEN 'UNIQUE'
            ELSE ''
        END AS constraints
    FROM information_schema.columns c
    LEFT JOIN (
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'public'
    ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
    LEFT JOIN (
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            tc.constraint_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
    ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
    LEFT JOIN (
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE' 
        AND tc.table_schema = 'public'
    ) uk ON c.table_name = uk.table_name AND c.column_name = uk.column_name
    WHERE c.table_schema = 'public'
)
SELECT 
    table_name,
    string_agg(
        format('  %s %s %s %s %s',
            rpad(column_name, 30),
            rpad(full_data_type, 25),
            rpad(CASE WHEN is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END, 8),
            rpad(COALESCE(column_default, ''), 30),
            constraints
        ),
        E'\n' ORDER BY ordinal_position
    ) AS columns
FROM table_columns
GROUP BY table_name
ORDER BY table_name;

-- 4. ALL INDEXES
SELECT 
    '=== INDEXES ===' as section;

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. ALL FOREIGN KEY RELATIONSHIPS
SELECT 
    '=== FOREIGN KEY RELATIONSHIPS ===' as section;

SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 6. ALL CHECK CONSTRAINTS
SELECT 
    '=== CHECK CONSTRAINTS ===' as section;

SELECT 
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name 
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public' 
AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- 7. ALL FUNCTIONS
SELECT 
    '=== FUNCTIONS ===' as section;

SELECT 
    proname AS function_name,
    pg_get_function_identity_arguments(oid) AS arguments,
    pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 8. ALL TRIGGERS
SELECT 
    '=== TRIGGERS ===' as section;

SELECT 
    trigger_schema,
    trigger_name,
    event_object_table AS table_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 9. MISSING TABLES FROM MIGRATION ANALYSIS
SELECT 
    '=== POTENTIALLY MISSING TABLES ===' as section;

WITH expected_tables AS (
    SELECT unnest(ARRAY[
        -- Email system
        'email_filing_configs',
        'email_filing_logs',
        'email_filing_attachments',
        'email_configurations',
        'email_processing_logs',
        'reserved_subdomains',
        'system_config',
        -- Billing
        'subscription_plans',
        'user_subscriptions',
        'usage_events',
        'user_quotas',
        'monthly_usage_summaries',
        'billing_invoices',
        -- Producer portal
        'producer_portal_config',
        'producers',
        'producer_sessions',
        'producer_submissions',
        'portal_lines_of_business',
        'producer_lob_access',
        'producer_audit_log',
        'producer_route_access',
        'permissions',
        'user_permissions',
        'excel_premium_mappings',
        -- Custom routes
        'custom_routes',
        'custom_route_fields',
        'custom_route_submissions',
        'custom_route_workflow_log',
        'custom_route_raters',
        'ims_configuration_cache',
        -- Webhooks
        'custom_webhooks',
        'webhook_executions',
        'webhook_templates',
        'ims_function_mappings',
        -- Form builder
        'form_schemas',
        'form_submissions',
        'form_templates'
    ]) AS table_name
),
existing_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
SELECT 
    et.table_name AS missing_table
FROM expected_tables et
LEFT JOIN existing_tables ext ON et.table_name = ext.table_name
WHERE ext.table_name IS NULL
ORDER BY et.table_name;

-- 10. SCHEMA DIFFERENCES
SELECT 
    '=== EXTRA TABLES NOT IN MIGRATIONS ===' as section;

WITH expected_tables AS (
    SELECT unnest(ARRAY[
        -- List same as above
        'email_filing_configs',
        'email_filing_logs',
        'email_filing_attachments',
        'email_configurations',
        'email_processing_logs',
        'reserved_subdomains',
        'system_config',
        'subscription_plans',
        'user_subscriptions',
        'usage_events',
        'user_quotas',
        'monthly_usage_summaries',
        'billing_invoices',
        'producer_portal_config',
        'producers',
        'producer_sessions',
        'producer_submissions',
        'portal_lines_of_business',
        'producer_lob_access',
        'producer_audit_log',
        'producer_route_access',
        'permissions',
        'user_permissions',
        'excel_premium_mappings',
        'custom_routes',
        'custom_route_fields',
        'custom_route_submissions',
        'custom_route_workflow_log',
        'custom_route_raters',
        'ims_configuration_cache',
        'custom_webhooks',
        'webhook_executions',
        'webhook_templates',
        'ims_function_mappings',
        'form_schemas',
        'form_submissions',
        'form_templates'
    ]) AS table_name
)
SELECT 
    t.table_name AS extra_table
FROM information_schema.tables t
LEFT JOIN expected_tables et ON t.table_name = et.table_name
WHERE t.table_schema = 'public' 
AND t.table_type = 'BASE TABLE'
AND et.table_name IS NULL
ORDER BY t.table_name;