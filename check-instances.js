const pool = require('./config/db');

async function checkInstances() {
    try {
        console.log('Checking IMS instances in database...\n');
        
        // Get all instances
        const instances = await pool.query(`
            SELECT 
                instance_id, 
                name, 
                url, 
                username,
                email_subdomain,
                created_at
            FROM ims_instances 
            ORDER BY instance_id
        `);
        
        if (instances.rows.length === 0) {
            console.log('❌ No instances found in database');
        } else {
            console.log(`Found ${instances.rows.length} instances:\n`);
            instances.rows.forEach(instance => {
                console.log(`Instance ID: ${instance.instance_id}`);
                console.log(`  Name: ${instance.name}`);
                console.log(`  URL: ${instance.url}`);
                console.log(`  Username: ${instance.username}`);
                console.log(`  Subdomain: ${instance.email_subdomain || '(none)'}`);
                console.log(`  Created: ${instance.created_at}`);
                console.log('');
            });
        }
        
        // Also check users
        const users = await pool.query(`
            SELECT user_id, username, email 
            FROM users 
            LIMIT 5
        `);
        
        console.log('Users in system:');
        users.rows.forEach(user => {
            console.log(`  - ${user.username} (${user.email})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkInstances();