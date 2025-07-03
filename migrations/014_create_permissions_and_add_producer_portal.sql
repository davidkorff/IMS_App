-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    PRIMARY KEY (user_id, permission_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);

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