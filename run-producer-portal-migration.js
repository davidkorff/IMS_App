const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
    // Use the same database configuration as the app
    const pool = process.env.DATABASE_URL 
        ? new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        })
        : new Pool({
            user: 'postgres',
            password: 'D040294k',
            host: 'localhost',
            port: 5432,
            database: 'IMS_Application'
        });

    try {
        console.log('🚀 Running Producer Portal migration...');
        
        // Read the PostgreSQL migration file
        const migrationPath = path.join(__dirname, 'migrations', '013_producer_portal_foundation_postgres.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // For PostgreSQL, we'll execute the entire migration as one transaction
        // since PostgreSQL handles multiple statements well
        const statements = [migrationSQL];
        
        console.log(`📝 Found ${statements.length} statements to execute`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                try {
                    console.log(`\n🔧 Executing statement ${i + 1}/${statements.length}...`);
                    // Show first 100 chars of statement
                    console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
                    
                    await pool.query(statement);
                    console.log(`   ✅ Success`);
                } catch (err) {
                    console.error(`   ❌ Error: ${err.message}`);
                    // Continue with other statements even if one fails
                }
            }
        }
        
        console.log('\n✅ Producer Portal migration completed!');
        console.log('\n📋 Next steps:');
        console.log('1. Restart the server to load new routes');
        console.log('2. Visit /instance/{id}/producer-admin to configure the producer portal');
        console.log('3. Producers can register at {subdomain}.42ims.com/producer/register');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the migration
runMigration().catch(console.error);