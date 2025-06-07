const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration(migrationFile) {
    try {
        if (!migrationFile) {
            console.error('Please specify a migration file');
            console.log('Usage: node run-migration-generic.js <migration-file>');
            console.log('Example: node run-migration-generic.js migrations/007_add_custom_domain_support.sql');
            process.exit(1);
        }

        console.log(`Running migration: ${migrationFile}...`);
        
        const migrationPath = path.join(__dirname, migrationFile);
        
        if (!fs.existsSync(migrationPath)) {
            console.error(`Migration file not found: ${migrationPath}`);
            process.exit(1);
        }
        
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // For custom domain migration, check if column was added
        if (migrationFile.includes('custom_domain')) {
            const result = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'ims_instances' 
                AND column_name = 'custom_domain'
            `);
            
            if (result.rows.length > 0) {
                console.log('✅ Column custom_domain exists in ims_instances table');
            } else {
                console.log('❌ Column custom_domain was not added');
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

// Get migration file from command line arguments
const migrationFile = process.argv[2];
runMigration(migrationFile);