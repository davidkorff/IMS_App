// Run the legacy email config fix
const { Pool } = require('pg');

async function fixLegacyEmailConfig() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('🔍 Checking current email_config field...');
        
        // Check what's currently in the email_config field
        const current = await pool.query(`
            SELECT 
                instance_id, 
                name, 
                email_config,
                email_status
            FROM ims_instances 
            WHERE instance_id = 1
        `);
        
        console.log('Current state:', current.rows[0]);
        
        console.log('\n🔧 Clearing old email_config JSONB field...');
        
        // Clear the old email_config JSONB field
        const updateResult = await pool.query(`
            UPDATE ims_instances 
            SET email_config = NULL
            WHERE instance_id = 1
            RETURNING *
        `);
        
        console.log('✅ Updated successfully:', updateResult.rows[0]);
        
        console.log('\n🔍 Final state:');
        const final = await pool.query(`
            SELECT 
                instance_id, 
                name, 
                email_config,
                email_status
            FROM ims_instances 
            WHERE instance_id = 1
        `);
        
        console.log(final.rows[0]);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

fixLegacyEmailConfig();