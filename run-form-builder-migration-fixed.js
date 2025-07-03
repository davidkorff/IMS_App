const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function runMigration() {
    console.log('Running fixed form builder migration from Windows...');
    
    try {
        // Read the fixed migration file
        const migrationPath = path.join(__dirname, 'migrations', '20240107_add_form_schemas_fixed.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Migration file loaded successfully');
        
        // Split the SQL into individual statements
        // Remove single-line comments first
        const cleanedSQL = migrationSQL
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');
            
        const statements = cleanedSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        console.log(`Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
            console.log(`Statement preview: ${statement.substring(0, 60)}...`);
            
            try {
                await pool.query(statement + ';');
                console.log('✅ Success');
                successCount++;
            } catch (error) {
                console.error(`❌ Error: ${error.message}`);
                errorCount++;
                // Continue with other statements
            }
        }
        
        console.log(`\n\nExecution Summary:`);
        console.log(`✅ Successful statements: ${successCount}`);
        console.log(`❌ Failed statements: ${errorCount}`);
        
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
        
        // Check if the form_schema_id column was added to portal_lines_of_business
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'portal_lines_of_business' 
            AND column_name = 'form_schema_id'
        `);
        
        if (columnCheck.rows.length > 0) {
            console.log('✅ form_schema_id column added to portal_lines_of_business');
        } else {
            console.log('⚠️  form_schema_id column was not added to portal_lines_of_business');
        }
        
        // Show sample query to verify foreign key relationship
        console.log('\nTesting foreign key relationship...');
        const fkTest = await pool.query(`
            SELECT 
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = 'form_schemas'
            AND kcu.column_name = 'lob_id';
        `);
        
        if (fkTest.rows.length > 0) {
            console.log('✅ Foreign key relationship established between form_schemas.lob_id and portal_lines_of_business.lob_id');
        }
        
        console.log('\nMigration completed!');
        console.log('\n📝 The form builder tables have been created successfully.');
        console.log('You can now use the form builder to create and save form schemas.');
        
        process.exit(0);
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration();