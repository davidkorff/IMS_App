const pool = require('./config/db');

async function emergencyFixDuplicates() {
    console.log('🚨 EMERGENCY FIX: Stopping duplicate email processing...\n');
    
    try {
        // Step 1: Add the column if it doesn't exist
        console.log('Step 1: Adding last_processed_timestamp column if missing...');
        try {
            await pool.query(`
                ALTER TABLE email_configurations 
                ADD COLUMN IF NOT EXISTS last_processed_timestamp TIMESTAMP DEFAULT '2024-01-01 00:00:00'
            `);
            console.log('✅ Column added/verified');
        } catch (error) {
            console.log('Column might already exist:', error.message);
        }
        
        // Step 2: Set last_processed_timestamp to NOW for all configurations
        // This will prevent ALL old emails from being reprocessed
        console.log('\nStep 2: Setting last_processed_timestamp to current time...');
        const updateResult = await pool.query(`
            UPDATE email_configurations 
            SET last_processed_timestamp = CURRENT_TIMESTAMP
            WHERE last_processed_timestamp IS NULL 
               OR last_processed_timestamp < '2024-01-02'
            RETURNING id, email_address, last_processed_timestamp
        `);
        
        if (updateResult.rows.length > 0) {
            console.log(`✅ Updated ${updateResult.rows.length} configurations:`);
            updateResult.rows.forEach(row => {
                console.log(`   - Config ${row.id}: ${row.email_address} -> ${row.last_processed_timestamp}`);
            });
        } else {
            console.log('✅ All configurations already have recent timestamps');
        }
        
        // Step 3: Verify the fix
        console.log('\nStep 3: Verifying the fix...');
        const verifyResult = await pool.query(`
            SELECT 
                id,
                email_address,
                last_processed_timestamp,
                CASE 
                    WHEN last_processed_timestamp > NOW() - INTERVAL '1 day' 
                    THEN 'Recent - No duplicates' 
                    ELSE 'Old - May process old emails' 
                END as status
            FROM email_configurations
            ORDER BY id
        `);
        
        console.log('\nCurrent configuration status:');
        verifyResult.rows.forEach(row => {
            console.log(`Config ${row.id} (${row.email_address}): ${row.status}`);
            console.log(`  Last processed: ${row.last_processed_timestamp}`);
        });
        
        console.log('\n✅ EMERGENCY FIX COMPLETE!');
        console.log('\n📝 What this fix did:');
        console.log('1. Added the missing last_processed_timestamp column');
        console.log('2. Set all timestamps to NOW to prevent reprocessing old emails');
        console.log('3. From now on, only NEW emails will be processed');
        console.log('\n⚠️  Note: Any emails received in the last few minutes might be processed once more,');
        console.log('    but after that, no duplicates will occur.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Emergency fix failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

emergencyFixDuplicates();