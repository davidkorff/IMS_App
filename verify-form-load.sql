-- 1. Check if the form schema was created
SELECT 
    form_id,
    title,
    instance_id,
    lob_id,
    created_at,
    jsonb_pretty(form_schema -> 'metadata') as metadata
FROM form_schemas 
WHERE instance_id = 4 
AND lob_id = 4
ORDER BY created_at DESC;

-- 2. Check if the LOB was updated with the form_schema_id
SELECT 
    lob_id,
    line_name,
    form_schema_id,
    updated_at
FROM portal_lines_of_business 
WHERE lob_id = 4;

-- 3. Count pages and fields in the form
SELECT 
    form_id,
    title,
    jsonb_array_length(form_schema -> 'pages') as page_count,
    jsonb_object_keys(form_schema -> 'fields') as field_keys
FROM form_schemas 
WHERE instance_id = 4 
AND lob_id = 4
ORDER BY created_at DESC
LIMIT 1;

-- 4. Show first page structure
SELECT 
    form_id,
    title,
    jsonb_pretty(form_schema -> 'pages' -> 0) as first_page
FROM form_schemas 
WHERE instance_id = 4 
AND lob_id = 4
ORDER BY created_at DESC
LIMIT 1;

-- 5. Quick summary
SELECT 
    fs.form_id,
    fs.title as form_title,
    lob.line_name,
    fs.created_at,
    CASE 
        WHEN lob.form_schema_id = fs.form_id THEN '✅ Linked to LOB'
        ELSE '❌ Not linked to LOB'
    END as status
FROM form_schemas fs
LEFT JOIN portal_lines_of_business lob ON lob.form_schema_id = fs.form_id
WHERE fs.instance_id = 4 
AND fs.lob_id = 4
ORDER BY fs.created_at DESC;