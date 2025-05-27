const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function fixEmailIssues() {
    console.log('🔧 Fixing email filing issues...\n');
    
    try {
        // Step 1: Run migration to add last_processed_timestamp
        console.log('Step 1: Adding last_processed_timestamp column...');
        try {
            const migrationSQL = fs.readFileSync(
                path.join(__dirname, 'migrations', '004_add_last_processed_timestamp.sql'), 
                'utf8'
            );
            await pool.query(migrationSQL);
            console.log('✅ Migration completed successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('✅ Column already exists');
            } else {
                throw error;
            }
        }
        
        // Step 2: Fix email_status for instances with configurations
        console.log('\nStep 2: Fixing email status for configured instances...');
        
        const updateResult = await pool.query(`
            UPDATE ims_instances 
            SET email_status = 'active'
            WHERE instance_id IN (
                SELECT DISTINCT instance_id 
                FROM email_configurations
            )
            AND (email_status IS NULL OR email_status = 'not_configured')
            RETURNING instance_id, name, email_status
        `);
        
        if (updateResult.rows.length > 0) {
            console.log('✅ Updated email status for:');
            updateResult.rows.forEach(row => {
                console.log(`   - Instance ${row.instance_id} (${row.name})`);
            });
        } else {
            console.log('✅ All instances already have correct status');
        }
        
        // Step 3: Verify the fixes
        console.log('\nStep 3: Verifying fixes...');
        
        // Check instance 1 specifically
        const verifyResult = await pool.query(`
            SELECT 
                ii.instance_id,
                ii.name,
                ii.email_status,
                ec.id as config_id,
                ec.config_type,
                ec.email_address,
                ec.last_processed_timestamp
            FROM ims_instances ii
            LEFT JOIN email_configurations ec ON ii.instance_id = ec.instance_id
            WHERE ii.instance_id = 1
        `);
        
        if (verifyResult.rows.length > 0) {
            console.log('\nInstance 1 status:');
            const instance = verifyResult.rows[0];
            console.log(`- Name: ${instance.name}`);
            console.log(`- Email Status: ${instance.email_status}`);
            if (instance.config_id) {
                console.log(`- Config Type: ${instance.config_type}`);
                console.log(`- Email Address: ${instance.email_address}`);
                console.log(`- Last Processed: ${instance.last_processed_timestamp || 'Not set yet'}`);
            }
        }
        
        console.log('\n✅ All fixes completed successfully!');
        console.log('\n📝 Summary:');
        console.log('1. Email reprocessing issue fixed - emails will only be processed once');
        console.log('2. Email configuration page will now show your existing setup');
        console.log('\nPlease refresh your browser to see the changes.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixEmailIssues();