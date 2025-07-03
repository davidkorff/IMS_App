-- Add producer portal permission
INSERT INTO permissions (permission_name, description) 
VALUES ('producer_portal.view', 'View and manage producer portal')
ON CONFLICT (permission_name) DO NOTHING;

-- Grant permission to user ID 1 (admin)
INSERT INTO user_permissions (user_id, permission_id)
SELECT 1, permission_id 
FROM permissions 
WHERE permission_name = 'producer_portal.view'
AND NOT EXISTS (
    SELECT 1 FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.permission_id
    WHERE up.user_id = 1 AND p.permission_name = 'producer_portal.view'
);

-- You can also grant to other users by adding more INSERT statements:
-- INSERT INTO user_permissions (user_id, permission_id)
-- SELECT 2, permission_id FROM permissions WHERE permission_name = 'producer_portal.view';