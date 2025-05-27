const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Running last processed timestamp migration...');
        
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '004_add_last_processed_timestamp.sql'), 
            'utf8'
        );
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Check if column was added
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'email_configurations' 
            AND column_name = 'last_processed_timestamp'
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ Column last_processed_timestamp exists in email_configurations table');
        } else {
            console.log('❌ Column was not added');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();