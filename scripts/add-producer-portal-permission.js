const pool = require('../config/db');

async function addProducerPortalPermission() {
    const client = await pool.connect();
    try {
        // First check if the permission exists
        const permCheck = await client.query(
            "SELECT permission_id FROM permissions WHERE permission_name = 'producer_portal.view'"
        );
        
        let permissionId;
        if (permCheck.rows.length === 0) {
            // Create the permission
            const permResult = await client.query(
                "INSERT INTO permissions (permission_name, description) VALUES ('producer_portal.view', 'View and manage producer portal') RETURNING permission_id"
            );
            permissionId = permResult.rows[0].permission_id;
            console.log('✅ Created producer_portal.view permission');
        } else {
            permissionId = permCheck.rows[0].permission_id;
            console.log('ℹ️  Permission already exists');
        }
        
        // Get all admin users (you may want to adjust this query)
        const users = await client.query(
            "SELECT user_id, username FROM users WHERE user_id = 1" // Assuming user 1 is the main admin
        );
        
        for (const user of users.rows) {
            // Check if user already has permission
            const hasPermCheck = await client.query(
                "SELECT 1 FROM user_permissions WHERE user_id = $1 AND permission_id = $2",
                [user.user_id, permissionId]
            );
            
            if (hasPermCheck.rows.length === 0) {
                // Add permission
                await client.query(
                    "INSERT INTO user_permissions (user_id, permission_id) VALUES ($1, $2)",
                    [user.user_id, permissionId]
                );
                console.log(`✅ Added producer_portal.view permission to user: ${user.username}`);
            } else {
                console.log(`ℹ️  User ${user.username} already has permission`);
            }
        }
        
        console.log('\n✅ Permission setup complete!');
        console.log('You can now log in and access the producer admin page.');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addProducerPortalPermission();