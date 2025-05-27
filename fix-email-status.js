const pool = require('./config/db');

async function fixEmailStatus() {
    try {
        console.log('Fixing email status for instances with email configurations...\n');
        
        // First, check current status
        const checkResult = await pool.query(`
            SELECT 
                ii.instance_id,
                ii.name,
                ii.email_status,
                COUNT(ec.id) as config_count
            FROM ims_instances ii
            LEFT JOIN email_configurations ec ON ii.instance_id = ec.instance_id
            GROUP BY ii.instance_id, ii.name, ii.email_status
            HAVING COUNT(ec.id) > 0
        `);
        
        console.log('Instances with email configurations:');
        checkResult.rows.forEach(row => {
            console.log(`- Instance ${row.instance_id} (${row.name}): ${row.config_count} configs, status: ${row.email_status}`);
        });
        
        // Update email_status to 'active' for instances that have email configurations
        const updateResult = await pool.query(`
            UPDATE ims_instances 
            SET email_status = 'active'
            WHERE instance_id IN (
                SELECT DISTINCT instance_id 
                FROM email_configurations 
                WHERE test_status = 'success'
            )
            AND email_status != 'active'
            RETURNING instance_id, name, email_status
        `);
        
        if (updateResult.rows.length > 0) {
            console.log('\n✅ Updated email status for:');
            updateResult.rows.forEach(row => {
                console.log(`   - Instance ${row.instance_id} (${row.name}) -> ${row.email_status}`);
            });
        } else {
            console.log('\n✅ No instances needed status updates');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixEmailStatus();