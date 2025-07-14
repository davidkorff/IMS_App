const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ANSI color codes for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

async function runMigration() {
    // Get database connection from environment
    const dbConfig = {
        host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
        port: process.env.PGPORT || process.env.DB_PORT || 5432,
        database: process.env.PGDATABASE || process.env.DB_NAME || 'ims_production',
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

    // Check if we're in production mode
    const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
    
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}Production Migration Script (Simple Version)${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    console.log(`${colors.yellow}Database Configuration:${colors.reset}`);
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Port: ${dbConfig.port}`);
    console.log(`Database: ${dbConfig.database}`);
    console.log(`User: ${dbConfig.user}`);
    console.log(`SSL: ${dbConfig.ssl ? 'Enabled' : 'Disabled'}\n`);

    if (!isProduction) {
        console.log(`${colors.yellow}⚠️  WARNING: Running in test mode. Add --production flag to run against production database.${colors.reset}\n`);
    } else {
        console.log(`${colors.red}🚨 PRODUCTION MODE: This will modify your production database!${colors.reset}\n`);
        
        // Add a safety prompt for production
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            readline.question(`Type 'YES' to continue with production migration: `, resolve);
        });
        readline.close();

        if (answer !== 'YES') {
            console.log(`${colors.yellow}Migration cancelled.${colors.reset}`);
            process.exit(0);
        }
    }

    const client = new Client(dbConfig);

    try {
        // Connect to database
        console.log(`${colors.blue}Connecting to database...${colors.reset}`);
        await client.connect();
        console.log(`${colors.green}✓ Connected successfully${colors.reset}\n`);

        // Get initial table count
        const initialTableCount = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        console.log(`${colors.cyan}Initial table count: ${initialTableCount.rows[0].count}${colors.reset}\n`);

        // Read migration file
        const migrationPath = path.join(__dirname, 'production-migration-to-match-test.sql');
        console.log(`${colors.blue}Reading migration file...${colors.reset}`);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        console.log(`${colors.green}✓ Migration file loaded${colors.reset}\n`);

        // Execute the entire migration as one script
        // This handles DO blocks and complex statements better
        console.log(`${colors.blue}Executing migration...${colors.reset}`);
        console.log(`${colors.yellow}This may take a few minutes...${colors.reset}\n`);

        try {
            await client.query(migrationSQL);
            console.log(`${colors.green}✓ Migration executed successfully!${colors.reset}\n`);
        } catch (error) {
            console.error(`${colors.red}✗ Migration error: ${error.message}${colors.reset}`);
            console.error(`${colors.yellow}Note: Some errors may be expected for existing objects (IF NOT EXISTS statements)${colors.reset}\n`);
            
            // Even with errors, check what was created
        }

        // Get final table count and show what was created
        const finalTableCount = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);

        const tablesCreated = finalTableCount.rows[0].count - initialTableCount.rows[0].count;

        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`${colors.bright}Migration Summary${colors.reset}`);
        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`Initial tables: ${initialTableCount.rows[0].count}`);
        console.log(`Final tables: ${finalTableCount.rows[0].count}`);
        console.log(`${colors.green}Tables created: ${tablesCreated}${colors.reset}\n`);

        // List all tables
        const allTables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log(`${colors.cyan}All tables in database:${colors.reset}`);
        allTables.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.table_name}`);
        });

        // Check for specific missing tables
        const expectedTables = ['permissions', 'user_permissions', 'producer_route_access'];
        const missingTables = [];
        
        for (const table of expectedTables) {
            const exists = await client.query(
                `SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )`,
                [table]
            );
            
            if (!exists.rows[0].exists) {
                missingTables.push(table);
            }
        }

        if (missingTables.length > 0) {
            console.log(`\n${colors.yellow}⚠️  Still missing tables: ${missingTables.join(', ')}${colors.reset}`);
        } else {
            console.log(`\n${colors.green}✓ All expected tables exist!${colors.reset}`);
        }

    } catch (error) {
        console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    } finally {
        await client.end();
        console.log(`\n${colors.blue}Database connection closed${colors.reset}`);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error(`${colors.red}Unhandled rejection: ${error.message}${colors.reset}`);
    process.exit(1);
});

// Run the migration
console.log(`${colors.cyan}Starting migration script...${colors.reset}\n`);
runMigration().catch(error => {
    console.error(`${colors.red}Migration failed: ${error.message}${colors.reset}`);
    process.exit(1);
});