const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.ims' });

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

async function runSync() {
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}Sync Production Schema (Keep Data)${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    // Check if production flag is set
    const isProduction = process.argv.includes('--production');
    
    if (!isProduction) {
        console.log(`${colors.yellow}SAFETY CHECK: Add --production flag to run this script${colors.reset}`);
        console.log(`${colors.yellow}Example: node run-sync-schema.js --production${colors.reset}\n`);
        process.exit(1);
    }

    // Production database config from environment
    const dbConfig = {
        host: process.env.PGHOST,
        port: process.env.PGPORT || 5432,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
    };

    console.log(`${colors.yellow}Production Database:${colors.reset}`);
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Database: ${dbConfig.database}`);
    console.log(`User: ${dbConfig.user}\n`);

    console.log(`${colors.red}⚠️  This will modify your PRODUCTION database!${colors.reset}`);
    console.log(`${colors.green}✓ Your data will be preserved${colors.reset}`);
    console.log(`${colors.green}✓ Only missing tables/columns will be added${colors.reset}\n`);

    // Confirmation prompt
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const answer = await new Promise(resolve => {
        readline.question(`Type 'YES' to continue: `, resolve);
    });
    readline.close();

    if (answer !== 'YES') {
        console.log(`${colors.yellow}Sync cancelled.${colors.reset}`);
        process.exit(0);
    }

    const client = new Client(dbConfig);

    try {
        // Connect
        console.log(`\n${colors.blue}Connecting to production database...${colors.reset}`);
        await client.connect();
        console.log(`${colors.green}✓ Connected${colors.reset}\n`);

        // Get initial counts
        const initialCounts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
                (SELECT COUNT(*) FROM producers) as producer_count,
                (SELECT COUNT(*) FROM custom_route_submissions) as submission_count
        `);
        
        console.log(`${colors.cyan}Current state:${colors.reset}`);
        console.log(`Tables: ${initialCounts.rows[0].table_count}`);
        console.log(`Producers: ${initialCounts.rows[0].producer_count}`);
        console.log(`Submissions: ${initialCounts.rows[0].submission_count}\n`);

        // Read and execute sync script
        const syncSQL = fs.readFileSync(path.join(__dirname, 'sync-schema-keep-data.sql'), 'utf8');
        
        console.log(`${colors.blue}Running schema sync...${colors.reset}`);
        await client.query(syncSQL);
        console.log(`${colors.green}✓ Schema sync completed!${colors.reset}\n`);

        // Get final counts
        const finalCounts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
                (SELECT COUNT(*) FROM producers) as producer_count,
                (SELECT COUNT(*) FROM custom_route_submissions) as submission_count,
                (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions')) as has_permissions,
                (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'excel_premium_mappings')) as has_excel_mappings,
                (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_lines_of_business' AND column_name = 'formula_calc_method')) as has_formula_method
        `);

        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`${colors.bright}Results${colors.reset}`);
        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`Tables: ${initialCounts.rows[0].table_count} → ${finalCounts.rows[0].table_count}`);
        console.log(`${colors.green}✓ Data preserved:${colors.reset}`);
        console.log(`  - Producers: ${finalCounts.rows[0].producer_count}`);
        console.log(`  - Submissions: ${finalCounts.rows[0].submission_count}`);
        console.log(`${colors.green}✓ New tables added:${colors.reset}`);
        console.log(`  - permissions: ${finalCounts.rows[0].has_permissions ? 'Yes' : 'No'}`);
        console.log(`  - excel_premium_mappings: ${finalCounts.rows[0].has_excel_mappings ? 'Yes' : 'No'}`);
        console.log(`${colors.green}✓ New columns added:${colors.reset}`);
        console.log(`  - formula_calc_method: ${finalCounts.rows[0].has_formula_method ? 'Yes' : 'No'}`);

        // Check excel_premium_mappings data
        const mappingCount = await client.query('SELECT COUNT(*) as count FROM excel_premium_mappings');
        console.log(`\n${colors.cyan}Excel mappings created: ${mappingCount.rows[0].count}${colors.reset}`);

    } catch (error) {
        console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
        if (error.detail) {
            console.error(`${colors.yellow}Detail: ${error.detail}${colors.reset}`);
        }
        process.exit(1);
    } finally {
        await client.end();
        console.log(`\n${colors.blue}Done!${colors.reset}`);
    }
}

// Run it
runSync().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});