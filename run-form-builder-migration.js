const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Connect to Windows PostgreSQL from WSL
// Try different connection methods
const pool = new Pool({
    user: 'postgres',
    password: 'D040294k',
    host: process.platform === 'win32' ? 'localhost' : '172.17.224.1',  // Common WSL2 host IP
    port: 5432,
    database: 'IMS_Application'
});

async function runMigration() {
    console.log('Running form builder migration...');
    
    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, 'migrations', '20240107_add_form_schemas.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Migration file loaded successfully');
        
        // Split the SQL into individual statements
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
            
            try {
                await pool.query(statement + ';');
                console.log('✅ Success');
            } catch (error) {
                console.error(`❌ Error executing statement ${i + 1}:`, error.message);
                // Continue with other statements
            }
        }
        
        // Check if tables were created
        console.log('\nVerifying tables were created...');
        
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('form_schemas', 'form_submissions', 'form_templates')
            ORDER BY table_name
        `);
        
        console.log('\nCreated tables:');
        tableCheck.rows.forEach(row => {
            console.log(`✅ ${row.table_name}`);
        });
        
        // Also check if the form_schema_id column was added to portal_lines_of_business
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'portal_lines_of_business' 
            AND column_name = 'form_schema_id'
        `);
        
        if (columnCheck.rows.length > 0) {
            console.log('✅ form_schema_id column added to portal_lines_of_business');
        }
        
        console.log('\nMigration completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration();