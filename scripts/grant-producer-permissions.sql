-- First, check if permissions exist, if not create them
INSERT INTO permissions (permission_name, description, category)
VALUES 
    ('producer_portal.view', 'View producer portal configuration', 'Producer Portal'),
    ('producer_portal.manage', 'Manage producer portal settings', 'Producer Portal'),
    ('producer_portal.producers.view', 'View producers', 'Producer Portal'),
    ('producer_portal.producers.approve', 'Approve/reject producers', 'Producer Portal'),
    ('producer_portal.producers.manage', 'Full producer management', 'Producer Portal'),
    ('producer_portal.lob.manage', 'Manage lines of business', 'Producer Portal'),
    ('producer_portal.submissions.view', 'View producer submissions', 'Producer Portal')
ON CONFLICT (permission_name) DO NOTHING;

-- Grant all producer portal permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'admin' 
AND p.category = 'Producer Portal'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
);

-- Also grant to any users who are admins
INSERT INTO user_permissions (user_id, permission_id)
SELECT ur.user_id, p.permission_id
FROM user_roles ur
JOIN roles r ON ur.role_id = r.role_id
CROSS JOIN permissions p
WHERE r.role_name = 'admin'
AND p.category = 'Producer Portal'
AND NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = ur.user_id AND up.permission_id = p.permission_id
);

-- Show what permissions were granted
SELECT u.email, p.permission_name
FROM users u
JOIN user_roles ur ON u.user_id = ur.user_id
JOIN roles r ON ur.role_id = r.role_id
LEFT JOIN user_permissions up ON u.user_id = up.user_id
LEFT JOIN permissions p ON up.permission_id = p.permission_id OR p.permission_id IN (
    SELECT permission_id FROM role_permissions WHERE role_id = r.role_id
)
WHERE p.category = 'Producer Portal'
ORDER BY u.email, p.permission_name;