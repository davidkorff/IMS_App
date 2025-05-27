// Test script to update the existing email address format
const { Pool } = require('pg');

// Database connection - update with your database URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database'
});

async function fixEmailAddress() {
    try {
        console.log('🔍 Checking current email configuration...');
        
        // Check current configuration
        const currentResult = await pool.query(`
            SELECT id, instance_id, email_address, email_prefix, config_type
            FROM email_configurations 
            WHERE instance_id = 1
        `);
        
        console.log('Current configuration:', currentResult.rows);
        
        // Update the email address format
        console.log('🔧 Updating email address format...');
        
        const updateResult = await pool.query(`
            UPDATE email_configurations 
            SET email_address = 'documents+origintest@42consultingllc.com',
                email_prefix = 'origintest'
            WHERE email_address = 'documents-origintest@42consultingllc.com'
            RETURNING *
        `);
        
        if (updateResult.rowCount > 0) {
            console.log('✅ Successfully updated email address:');
            console.log(updateResult.rows[0]);
        } else {
            console.log('ℹ️  No rows updated. The email address might already be in the correct format.');
        }
        
        // Verify the final state
        console.log('🔍 Final configuration:');
        const finalResult = await pool.query(`
            SELECT id, instance_id, email_address, email_prefix, config_type
            FROM email_configurations 
            WHERE instance_id = 1
        `);
        
        console.log(finalResult.rows);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

fixEmailAddress();