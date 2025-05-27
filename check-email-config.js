const pool = require('./config/db');

async function checkEmailConfig() {
    try {
        console.log('Checking email configuration for instance 1...\n');
        
        // Check instance status
        const instanceResult = await pool.query(`
            SELECT instance_id, name, email_status 
            FROM ims_instances 
            WHERE instance_id = 1
        `);
        
        if (instanceResult.rows.length > 0) {
            console.log('Instance details:');
            console.log(instanceResult.rows[0]);
            console.log('');
        }
        
        // Check email configurations
        const configResult = await pool.query(`
            SELECT id, instance_id, config_type, email_address, test_status, created_at
            FROM email_configurations 
            WHERE instance_id = 1
        `);
        
        if (configResult.rows.length > 0) {
            console.log('Email configurations:');
            configResult.rows.forEach(config => {
                console.log(`- Config ID: ${config.id}`);
                console.log(`  Type: ${config.config_type}`);
                console.log(`  Email: ${config.email_address}`);
                console.log(`  Test Status: ${config.test_status}`);
                console.log(`  Created: ${config.created_at}`);
                console.log('');
            });
        } else {
            console.log('❌ No email configurations found for instance 1');
        }
        
        // Check if last_processed_timestamp column exists
        const columnResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'email_configurations' 
            AND column_name = 'last_processed_timestamp'
        `);
        
        console.log(`last_processed_timestamp column exists: ${columnResult.rows.length > 0 ? '✅ Yes' : '❌ No'}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkEmailConfig();