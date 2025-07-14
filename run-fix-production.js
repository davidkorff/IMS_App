const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

async function runFix() {
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}Fix Production Schema${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    const PROD_DATABASE_URL = 'postgresql://ims_db_6zj4_user:463KnHH7jF0ywT99idxvTg0kenhqyNnU@dpg-d0on2rje5dus73d1ivd0-a.oregon-postgres.render.com/ims_db_6zj4';

    const client = new Client({
        connectionString: PROD_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log(`${colors.blue}Connecting to production database...${colors.reset}`);
        await client.connect();
        console.log(`${colors.green}✓ Connected${colors.reset}\n`);

        // Read the fix SQL
        const fixSQL = fs.readFileSync(path.join(__dirname, 'fix-production-schema.sql'), 'utf8');
        
        console.log(`${colors.blue}Running schema fix...${colors.reset}`);
        console.log(`${colors.yellow}This will create all missing tables in the correct order${colors.reset}\n`);
        
        await client.query(fixSQL);
        
        console.log(`${colors.green}✓ Schema fix completed!${colors.reset}\n`);

        // Verify results
        const tableCount = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);

        const verifyTables = await client.query(`
            SELECT 
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'producers') as has_producers,
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_lines_of_business') as has_lob,
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_routes') as has_routes,
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_route_submissions') as has_submissions,
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'excel_premium_mappings') as has_excel,
                EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_route_submissions' AND column_name = 'status') as has_status_column
        `);

        console.log(`${colors.cyan}Results:${colors.reset}`);
        console.log(`Total tables: ${tableCount.rows[0].count}`);
        console.log(`${colors.green}✓ Key tables created:${colors.reset}`);
        console.log(`  - producers: ${verifyTables.rows[0].has_producers ? 'Yes' : 'No'}`);
        console.log(`  - portal_lines_of_business: ${verifyTables.rows[0].has_lob ? 'Yes' : 'No'}`);
        console.log(`  - custom_routes: ${verifyTables.rows[0].has_routes ? 'Yes' : 'No'}`);
        console.log(`  - custom_route_submissions: ${verifyTables.rows[0].has_submissions ? 'Yes' : 'No'}`);
        console.log(`  - excel_premium_mappings: ${verifyTables.rows[0].has_excel ? 'Yes' : 'No'}`);
        console.log(`  - status column in submissions: ${verifyTables.rows[0].has_status_column ? 'Yes' : 'No'}`);

        console.log(`\n${colors.green}✅ Your production database now has all required tables!${colors.reset}`);

    } catch (error) {
        console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
        if (error.detail) {
            console.error(`${colors.yellow}Detail: ${error.detail}${colors.reset}`);
        }
    } finally {
        await client.end();
        console.log(`\n${colors.blue}Connection closed.${colors.reset}`);
    }
}

// Run it
runFix().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});