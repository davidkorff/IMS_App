const pool = require('./config/db');

async function fixConstraints() {
    console.log('🔧 Fixing email configuration constraints...');
    
    try {
        // Step 1: Drop the restrictive unique constraint
        console.log('1. Dropping instance_id unique constraint...');
        await pool.query(`
            ALTER TABLE email_configurations 
            DROP CONSTRAINT IF EXISTS email_configurations_instance_id_key;
        `);
        console.log('✅ Dropped instance_id constraint');

        // Step 2: Add email_address unique constraint (if not exists)
        console.log('2. Adding email_address unique constraint...');
        try {
            await pool.query(`
                ALTER TABLE email_configurations 
                ADD CONSTRAINT email_configurations_email_address_unique 
                UNIQUE (email_address);
            `);
            console.log('✅ Added email_address unique constraint');
        } catch (error) {
            if (error.code === '42P07') {
                console.log('ℹ️  Email address unique constraint already exists');
            } else {
                throw error;
            }
        }

        // Step 3: Add instance_id + email_prefix unique constraint
        console.log('3. Adding instance_id + email_prefix unique constraint...');
        try {
            await pool.query(`
                ALTER TABLE email_configurations 
                ADD CONSTRAINT email_configurations_instance_prefix_unique 
                UNIQUE (instance_id, email_prefix);
            `);
            console.log('✅ Added instance_prefix unique constraint');
        } catch (error) {
            if (error.code === '42P07') {
                console.log('ℹ️  Instance prefix unique constraint already exists');
            } else {
                throw error;
            }
        }

        // Verify constraints
        console.log('\n📋 Current constraints:');
        const result = await pool.query(`
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                string_agg(kcu.column_name, ', ') as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'email_configurations'
            AND tc.constraint_type = 'UNIQUE'
            GROUP BY tc.constraint_name, tc.constraint_type
            ORDER BY tc.constraint_name;
        `);

        result.rows.forEach(row => {
            console.log(`- ${row.constraint_name}: ${row.columns}`);
        });

        console.log('\n🎉 Email constraint fix completed successfully!');
        console.log('Now you can create multiple email configurations per instance.');

    } catch (error) {
        console.error('❌ Error fixing constraints:', error);
    } finally {
        pool.end();
    }
}

fixConstraints();