-- Check if form exists
SELECT 
    form_id,
    instance_id,
    lob_id,
    title,
    created_at
FROM form_schemas 
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';

-- Check what happens with instance_id = 4
SELECT 
    'With instance_id = 4:' as query,
    COUNT(*) as count
FROM form_schemas 
WHERE form_id = 'a1715135-94dc-456a-a68a-982ab0ed0fe1' 
AND instance_id = 4;

-- Check users table
SELECT 
    user_id,
    username,
    email,
    instance_id
FROM users
WHERE is_active = true
ORDER BY user_id
LIMIT 10;