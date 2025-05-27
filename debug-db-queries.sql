-- Database Investigation Queries for Document Visibility Issue

-- 1. List all tables in the database
SELECT table_name, table_schema
FROM information_schema.tables 
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
ORDER BY table_name;

-- 2. Find tables that might contain document data (look for 'doc', 'file', 'attachment' patterns)
SELECT table_name, table_schema
FROM information_schema.tables 
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
  AND (
    table_name ILIKE '%doc%' OR 
    table_name ILIKE '%file%' OR 
    table_name ILIKE '%attach%' OR
    table_name ILIKE '%folder%' OR
    table_name ILIKE '%content%'
  )
ORDER BY table_name;

-- 3. Check for recent document entries (using our test GUIDs)
-- Look for the GUIDs we just created:
-- 38370ea0-c2fd-42c7-a246-3381032a5770 (HTML document)
-- ac8be2f6-91c3-4d3b-8839-4133fc45c3f8 (PDF document)

-- Generic search across all tables for our test GUIDs
-- You'll need to run this for each table that might contain documents
-- Replace 'table_name' with actual table names from results above

-- Example searches (adjust table names based on what you find):
/*
SELECT * FROM documents WHERE id = '38370ea0-c2fd-42c7-a246-3381032a5770';
SELECT * FROM documents WHERE id = 'ac8be2f6-91c3-4d3b-8839-4133fc45c3f8';

SELECT * FROM document_files WHERE document_id = '38370ea0-c2fd-42c7-a246-3381032a5770';
SELECT * FROM document_files WHERE document_id = 'ac8be2f6-91c3-4d3b-8839-4133fc45c3f8';

SELECT * FROM attachments WHERE guid = '38370ea0-c2fd-42c7-a246-3381032a5770';
SELECT * FROM attachments WHERE guid = 'ac8be2f6-91c3-4d3b-8839-4133fc45c3f8';
*/

-- 4. Look for email filing logs to see what was recorded
SELECT * FROM email_filing_logs 
ORDER BY processed_at DESC 
LIMIT 10;

-- 5. Check usage events for our test
SELECT * FROM usage_events 
WHERE event_type IN ('email_processed', 'email_filed', 'webhook_call')
ORDER BY created_at DESC 
LIMIT 10;

-- 6. Look for any recent entries in all tables (to see what might have been created)
-- This will help identify which tables are actually being used

-- Check for entries created in the last hour
SELECT 'email_filing_configs' as table_name, COUNT(*) as recent_count
FROM email_filing_configs 
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 'email_filing_logs', COUNT(*)
FROM email_filing_logs 
WHERE processed_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 'usage_events', COUNT(*)
FROM usage_events 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 7. If you have a documents or files table, check recent entries
-- (Replace with actual table name once you find it)
/*
SELECT * FROM documents 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

SELECT * FROM files 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
*/

-- 8. Check table schemas to understand structure
-- Run this for any tables that look document-related
/*
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'documents'  -- Replace with actual table name
ORDER BY ordinal_position;
*/

-- 9. Search for any columns that might contain our test GUIDs
-- This is a more comprehensive search across all text/varchar columns
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
  AND data_type IN ('text', 'varchar', 'character varying', 'uuid')
ORDER BY table_name, column_name;