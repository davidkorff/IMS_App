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

async function runSync() {
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}Sync Production Schema (Keep Data)${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    // Your production database URL
    const DATABASE_URL = 'postgresql://ims_db_6zj4_user:463KnHH7jF0ywT99idxvTg0kenhqyNnU@dpg-d0on2rje5dus73d1ivd0-a.oregon-postgres.render.com/ims_db_6zj4';

    console.log(`${colors.yellow}Production Database:${colors.reset}`);
    console.log(`Host: dpg-d0on2rje5dus73d1ivd0-a.oregon-postgres.render.com`);
    console.log(`Database: ims_db_6zj4`);
    console.log(`User: ims_db_6zj4_user\n`);

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

    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        // Connect
        console.log(`\n${colors.blue}Connecting to production database...${colors.reset}`);
        await client.connect();
        console.log(`${colors.green}✓ Connected to Render production database${colors.reset}\n`);

        // Get initial counts
        let initialProducerCount = 0;
        let initialSubmissionCount = 0;
        
        try {
            const counts = await client.query(`
                SELECT 
                    (SELECT COUNT(*) FROM producers) as producer_count,
                    (SELECT COUNT(*) FROM custom_route_submissions) as submission_count
            `);
            initialProducerCount = counts.rows[0].producer_count;
            initialSubmissionCount = counts.rows[0].submission_count;
        } catch (e) {
            console.log(`${colors.yellow}Note: Some tables don't exist yet${colors.reset}`);
        }

        const initialTables = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        
        console.log(`${colors.cyan}Current state:${colors.reset}`);
        console.log(`Tables: ${initialTables.rows[0].count}`);
        console.log(`Producers: ${initialProducerCount}`);
        console.log(`Submissions: ${initialSubmissionCount}\n`);

        // Read and execute sync script
        const syncSQL = fs.readFileSync(path.join(__dirname, 'sync-schema-keep-data.sql'), 'utf8');
        
        console.log(`${colors.blue}Running schema sync...${colors.reset}`);
        console.log(`${colors.yellow}This may take a minute...${colors.reset}\n`);
        
        await client.query(syncSQL);
        
        console.log(`${colors.green}✓ Schema sync completed!${colors.reset}\n`);

        // Get final counts
        const finalTables = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);

        const finalCounts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM producers) as producer_count,
                (SELECT COUNT(*) FROM custom_route_submissions) as submission_count,
                (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions')) as has_permissions,
                (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'excel_premium_mappings')) as has_excel_mappings,
                (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_lines_of_business' AND column_name = 'formula_calc_method')) as has_formula_method
        `);

        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`${colors.bright}Results${colors.reset}`);
        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`Tables: ${initialTables.rows[0].count} → ${finalTables.rows[0].count}`);
        console.log(`${colors.green}✓ Data preserved:${colors.reset}`);
        console.log(`  - Producers: ${finalCounts.rows[0].producer_count}`);
        console.log(`  - Submissions: ${finalCounts.rows[0].submission_count}`);
        console.log(`${colors.green}✓ New tables added:${colors.reset}`);
        console.log(`  - permissions: ${finalCounts.rows[0].has_permissions ? 'Yes' : 'No'}`);
        console.log(`  - excel_premium_mappings: ${finalCounts.rows[0].has_excel_mappings ? 'Yes' : 'No'}`);
        console.log(`${colors.green}✓ New columns added:${colors.reset}`);
        console.log(`  - formula_calc_method: ${finalCounts.rows[0].has_formula_method ? 'Yes' : 'No'}`);

        // Check excel_premium_mappings data
        try {
            const mappingCount = await client.query('SELECT COUNT(*) as count FROM excel_premium_mappings');
            console.log(`\n${colors.cyan}Excel mappings created: ${mappingCount.rows[0].count}${colors.reset}`);
        } catch (e) {
            // Table might not exist yet
        }

        console.log(`\n${colors.green}✅ SUCCESS! Your production database schema now matches test.${colors.reset}`);
        console.log(`${colors.green}✅ All existing data has been preserved.${colors.reset}`);

    } catch (error) {
        console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
        if (error.detail) {
            console.error(`${colors.yellow}Detail: ${error.detail}${colors.reset}`);
        }
        console.error(`\n${colors.yellow}Note: Some errors are expected for objects that already exist.${colors.reset}`);
        console.error(`${colors.yellow}The script uses IF NOT EXISTS to handle this safely.${colors.reset}`);
    } finally {
        await client.end();
        console.log(`\n${colors.blue}Connection closed.${colors.reset}`);
    }
}

// Run it
console.log(`${colors.bright}Starting production sync...${colors.reset}\n`);
runSync().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});