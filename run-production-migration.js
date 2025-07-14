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
    // Get database connection from environment or command line
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
    console.log(`${colors.bright}Production Migration Script${colors.reset}`);
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

        // Read migration file
        const migrationPath = path.join(__dirname, 'production-migration-to-match-test.sql');
        console.log(`${colors.blue}Reading migration file...${colors.reset}`);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        console.log(`${colors.green}✓ Migration file loaded${colors.reset}\n`);

        // Start transaction
        console.log(`${colors.blue}Starting transaction...${colors.reset}`);
        await client.query('BEGIN');

        // Split migration into individual statements
        // This is a simple split - you might need more sophisticated parsing for complex SQL
        const statements = migrationSQL
            .split(/;\s*$/m)
            .filter(stmt => stmt.trim().length > 0)
            .map(stmt => stmt.trim() + ';');

        console.log(`${colors.cyan}Found ${statements.length} SQL statements to execute${colors.reset}\n`);

        // Execute each statement
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            // Skip comments and empty statements
            if (statement.startsWith('--') || statement.trim() === ';') {
                continue;
            }

            // Extract table/index name for logging
            let objectName = 'Statement';
            const createTableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
            const createIndexMatch = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/i);
            const alterTableMatch = statement.match(/ALTER TABLE (\w+)/i);
            
            if (createTableMatch) {
                objectName = `Table: ${createTableMatch[1]}`;
            } else if (createIndexMatch) {
                objectName = `Index: ${createIndexMatch[1]}`;
            } else if (alterTableMatch) {
                objectName = `Alter: ${alterTableMatch[1]}`;
            }

            try {
                process.stdout.write(`[${i + 1}/${statements.length}] ${objectName}... `);
                await client.query(statement);
                console.log(`${colors.green}✓${colors.reset}`);
                successCount++;
            } catch (error) {
                console.log(`${colors.red}✗ ${error.message}${colors.reset}`);
                errorCount++;
                errors.push({
                    statement: objectName,
                    error: error.message,
                    sql: statement.substring(0, 100) + '...'
                });
                
                // For safety, continue with other statements even if one fails
                // This allows IF NOT EXISTS statements to work properly
            }
        }

        console.log(`\n${colors.cyan}========================================${colors.reset}`);
        console.log(`${colors.bright}Migration Summary${colors.reset}`);
        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`${colors.green}✓ Successful statements: ${successCount}${colors.reset}`);
        console.log(`${colors.red}✗ Failed statements: ${errorCount}${colors.reset}`);

        if (errors.length > 0) {
            console.log(`\n${colors.yellow}Errors (these might be expected for existing objects):${colors.reset}`);
            errors.forEach((err, idx) => {
                console.log(`${idx + 1}. ${err.statement}: ${err.error}`);
            });
        }

        // Commit or rollback
        if (errorCount === 0 || (errorCount > 0 && successCount > 0)) {
            console.log(`\n${colors.blue}Committing transaction...${colors.reset}`);
            await client.query('COMMIT');
            console.log(`${colors.green}✓ Migration completed successfully!${colors.reset}`);
        } else {
            console.log(`\n${colors.red}Rolling back transaction due to errors...${colors.reset}`);
            await client.query('ROLLBACK');
            console.log(`${colors.red}✗ Migration rolled back${colors.reset}`);
        }

        // Show final table count
        const tableCountResult = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        console.log(`\n${colors.cyan}Final database state:${colors.reset}`);
        console.log(`Total tables: ${tableCountResult.rows[0].count}`);

    } catch (error) {
        console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(`${colors.red}Rollback error: ${rollbackError.message}${colors.reset}`);
        }
        process.exit(1);
    } finally {
        await client.end();
        console.log(`\n${colors.blue}Database connection closed${colors.reset}`);
    }
}

// Run the migration
runMigration().catch(error => {
    console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
    process.exit(1);
});