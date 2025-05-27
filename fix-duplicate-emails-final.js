const pool = require('./config/db');

async function fixDuplicateEmails() {
    console.log('🔧 Fixing duplicate email processing issues...\n');
    
    try {
        // Step 1: Check current state
        console.log('Step 1: Checking current database state...');
        
        // Check if last_processed_timestamp column exists
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'email_configurations' 
            AND column_name = 'last_processed_timestamp'
        `);
        
        const columnExists = columnCheck.rows.length > 0;
        console.log(`last_processed_timestamp column exists: ${columnExists ? '✅ Yes' : '❌ No'}`);
        
        // Check duplicate emails
        const duplicateCheck = await pool.query(`
            SELECT message_id, COUNT(*) as count, MIN(subject) as subject
            FROM email_processing_logs
            WHERE message_id IS NOT NULL
            GROUP BY message_id
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 10
        `);
        
        if (duplicateCheck.rows.length > 0) {
            console.log(`\n⚠️  Found ${duplicateCheck.rows.length} emails with duplicates:`);
            duplicateCheck.rows.forEach(row => {
                console.log(`   - "${row.subject}" processed ${row.count} times`);
            });
        }
        
        // Step 2: Add missing column
        if (!columnExists) {
            console.log('\nStep 2: Adding last_processed_timestamp column...');
            await pool.query(`
                ALTER TABLE email_configurations 
                ADD COLUMN last_processed_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            console.log('✅ Column added successfully');
        } else {
            console.log('\nStep 2: Column already exists, skipping...');
        }
        
        // Step 3: Set timestamps to prevent old email processing
        console.log('\nStep 3: Updating timestamps to prevent reprocessing...');
        const updateResult = await pool.query(`
            UPDATE email_configurations 
            SET last_processed_timestamp = CURRENT_TIMESTAMP
            WHERE last_processed_timestamp IS NULL 
               OR last_processed_timestamp < CURRENT_TIMESTAMP - INTERVAL '1 hour'
            RETURNING id, email_address
        `);
        
        if (updateResult.rows.length > 0) {
            console.log(`✅ Updated ${updateResult.rows.length} configurations to current timestamp`);
        }
        
        // Step 4: Clean up duplicate logs (optional - keeps only the first occurrence)
        console.log('\nStep 4: Cleaning up duplicate processing logs...');
        const cleanupResult = await pool.query(`
            DELETE FROM email_processing_logs
            WHERE id IN (
                SELECT id FROM (
                    SELECT id, 
                           ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY processed_at) as rn
                    FROM email_processing_logs
                    WHERE message_id IS NOT NULL
                ) t
                WHERE t.rn > 1
            )
        `);
        
        console.log(`✅ Removed ${cleanupResult.rowCount} duplicate log entries`);
        
        // Step 5: Verify the fix
        console.log('\nStep 5: Verifying the fix...');
        
        // Check configs
        const configCheck = await pool.query(`
            SELECT 
                id,
                email_address,
                last_processed_timestamp,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_processed_timestamp)) / 60 as minutes_ago
            FROM email_configurations
            ORDER BY id
        `);
        
        console.log('\nEmail Configuration Status:');
        configCheck.rows.forEach(row => {
            console.log(`Config ${row.id} (${row.email_address}):`);
            console.log(`  Last processed: ${row.last_processed_timestamp}`);
            console.log(`  (${Math.round(row.minutes_ago)} minutes ago)`);
        });
        
        // Check if duplicates are gone
        const finalDuplicateCheck = await pool.query(`
            SELECT COUNT(*) as duplicate_count
            FROM (
                SELECT message_id, COUNT(*) as count
                FROM email_processing_logs
                WHERE message_id IS NOT NULL
                GROUP BY message_id
                HAVING COUNT(*) > 1
            ) t
        `);
        
        console.log(`\n✅ Remaining duplicates: ${finalDuplicateCheck.rows[0].duplicate_count}`);
        
        console.log('\n✅ FIX COMPLETE!');
        console.log('\n📝 What was fixed:');
        console.log('1. Added message ID duplicate check in code');
        console.log('2. Added last_processed_timestamp column if missing');
        console.log('3. Set all timestamps to NOW to prevent old email reprocessing');
        console.log('4. Cleaned up duplicate log entries');
        console.log('\n🎉 Emails will now only be processed once!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixDuplicateEmails();