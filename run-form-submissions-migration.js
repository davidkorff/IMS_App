const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function runMigration() {
    console.log('Creating form_submissions table...');
    
    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, 'migrations', 'create_form_submissions_table_final.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Migration file loaded successfully');
        
        // Execute the entire migration as one transaction
        await pool.query('BEGIN');
        
        try {
            await pool.query(migrationSQL);
            await pool.query('COMMIT');
            console.log('✅ form_submissions table created successfully!');
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
        
        // Verify the table was created
        const tableCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'form_submissions'
            ORDER BY ordinal_position;
        `);
        
        console.log('\nform_submissions table structure:');
        console.log('==================================');
        tableCheck.rows.forEach(col => {
            console.log(`${col.column_name}: ${col.data_type}`);
        });
        
        // Check indexes
        const indexCheck = await pool.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'form_submissions'
            ORDER BY indexname;
        `);
        
        console.log('\nIndexes created:');
        console.log('================');
        indexCheck.rows.forEach(idx => {
            console.log(`✅ ${idx.indexname}`);
        });
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('The form builder is now fully set up and ready to use.');
        
        process.exit(0);
        
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

// Run the migration
runMigration();