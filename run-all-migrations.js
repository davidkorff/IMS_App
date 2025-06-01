const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runAllMigrations() {
    try {
        console.log('Running all database migrations...\n');
        
        // Create migrations tracking table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Get all migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        
        console.log(`Found ${files.length} migration files\n`);
        
        for (const file of files) {
            try {
                // Check if migration was already run
                const result = await pool.query(
                    'SELECT * FROM migrations WHERE filename = $1',
                    [file]
                );
                
                if (result.rows.length > 0) {
                    console.log(`⏭️  Skipping ${file} (already executed)`);
                    continue;
                }
                
                console.log(`📝 Running ${file}...`);
                
                // Read and execute migration
                const sql = fs.readFileSync(
                    path.join(migrationsDir, file),
                    'utf8'
                );
                
                // Split by GO statements if it's a SQL Server style script
                const statements = sql.split(/\nGO\n/i);
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        await pool.query(statement);
                    }
                }
                
                // Record migration as executed
                await pool.query(
                    'INSERT INTO migrations (filename) VALUES ($1)',
                    [file]
                );
                
                console.log(`✅ ${file} completed\n`);
                
            } catch (error) {
                console.error(`❌ Error in ${file}:`, error.message);
                throw error;
            }
        }
        
        console.log('✅ All migrations completed successfully!');
        
        // Show what tables were created
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'email_filing_rules',
                'email_filing_logs',
                'billing_usage',
                'email_configurations',
                'subdomain_email_configs',
                'unique_identifier_emails'
            )
            ORDER BY table_name
        `);
        
        console.log('\nCreated tables:');
        tables.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runAllMigrations();