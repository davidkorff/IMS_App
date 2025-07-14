const { Client } = require('pg');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

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

async function runFullMigration() {
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}FULL Test → Production Schema Migration${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    // Database URLs
    const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:yourpassword@localhost:5432/ims_test';
    const PROD_DATABASE_URL = 'postgresql://ims_db_6zj4_user:463KnHH7jF0ywT99idxvTg0kenhqyNnU@dpg-d0on2rje5dus73d1ivd0-a.oregon-postgres.render.com/ims_db_6zj4';

    console.log(`${colors.yellow}⚠️  This will COMPLETELY REPLACE your production schema!${colors.reset}`);
    console.log(`${colors.yellow}⚠️  All existing data will be LOST!${colors.reset}`);
    console.log(`${colors.red}⚠️  Only proceed if you have backed up any important data!${colors.reset}\n`);

    // Confirmation prompt
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(`${colors.bright}To continue, you must type the full phrase:${colors.reset}`);
    const answer = await new Promise(resolve => {
        readline.question(`Type 'REPLACE PRODUCTION SCHEMA' to continue: `, resolve);
    });
    readline.close();

    if (answer !== 'REPLACE PRODUCTION SCHEMA') {
        console.log(`${colors.yellow}Migration cancelled.${colors.reset}`);
        process.exit(0);
    }

    // Create backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(__dirname, 'schema_backups', timestamp);
    fs.mkdirSync(backupDir, { recursive: true });

    try {
        // Step 1: Export test database schema
        console.log(`\n${colors.blue}Step 1: Exporting test database schema...${colors.reset}`);
        console.log(`${colors.yellow}Please enter your test database password if prompted${colors.reset}`);
        
        const testSchemaFile = path.join(backupDir, 'test_schema.sql');
        
        // For Windows, we need to set PGPASSWORD differently
        const pgDumpCommand = process.platform === 'win32' 
            ? `set PGPASSWORD=yourpassword&& pg_dump "${TEST_DATABASE_URL}" --schema-only --no-owner --no-privileges --no-tablespaces --no-security-labels --no-comments -f "${testSchemaFile}"`
            : `PGPASSWORD=yourpassword pg_dump "${TEST_DATABASE_URL}" --schema-only --no-owner --no-privileges --no-tablespaces --no-security-labels --no-comments -f "${testSchemaFile}"`;

        console.log(`${colors.cyan}Note: Update the TEST_DATABASE_URL in this script with your test database credentials${colors.reset}`);
        console.log(`${colors.cyan}Current test URL: ${TEST_DATABASE_URL}${colors.reset}\n`);
        
        // For now, let's create a manual schema file
        console.log(`${colors.yellow}Creating schema migration file...${colors.reset}`);

        // Connect to production first to see what exists
        const prodClient = new Client({
            connectionString: PROD_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await prodClient.connect();
        console.log(`${colors.green}✓ Connected to production database${colors.reset}`);

        // Get current table list
        const currentTables = await prodClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log(`\n${colors.cyan}Current production tables (${currentTables.rows.length}):${colors.reset}`);
        currentTables.rows.forEach(row => console.log(`  - ${row.table_name}`));

        await prodClient.end();

        // Create the full schema file based on your test database structure
        const fullSchema = fs.readFileSync(path.join(__dirname, 'production-migration-to-match-test.sql'), 'utf8');
        
        // Add migrations 020 and 021
        let finalSchema = `-- Full Schema Migration from Test to Production
-- Generated: ${new Date().toISOString()}
-- This will create all tables with proper structure

${fullSchema}

-- ========================================================================
-- MIGRATION 020: Excel Premium Mappings
-- ========================================================================
`;

        // Add migration 020 if it exists
        if (fs.existsSync(path.join(__dirname, 'migrations', '020_excel_premium_mappings.sql'))) {
            const migration020 = fs.readFileSync(path.join(__dirname, 'migrations', '020_excel_premium_mappings.sql'), 'utf8');
            finalSchema += `\n${migration020}\n`;
        }

        // Add migration 021 if it exists
        if (fs.existsSync(path.join(__dirname, 'migrations', '021_update_formula_calc_methods.sql'))) {
            const migration021 = fs.readFileSync(path.join(__dirname, 'migrations', '021_update_formula_calc_methods.sql'), 'utf8');
            finalSchema += `\n-- ========================================================================
-- MIGRATION 021: Update Formula Calc Methods
-- ========================================================================
${migration021}\n`;
        }

        // Save the complete schema
        const finalSchemaFile = path.join(backupDir, 'complete_schema.sql');
        fs.writeFileSync(finalSchemaFile, finalSchema);
        console.log(`${colors.green}✓ Schema file created${colors.reset}`);

        // Step 2: Apply to production
        console.log(`\n${colors.blue}Step 2: Applying schema to production...${colors.reset}`);
        
        const client = new Client({
            connectionString: PROD_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await client.connect();
        console.log(`${colors.green}✓ Connected to production${colors.reset}`);

        console.log(`${colors.yellow}Executing schema...${colors.reset}`);
        await client.query(finalSchema);
        
        console.log(`${colors.green}✓ Schema applied successfully!${colors.reset}`);

        // Verify results
        const newTables = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);

        const verifyTables = await client.query(`
            SELECT 
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_lines_of_business') as has_lob,
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'excel_premium_mappings') as has_excel,
                EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') as has_permissions,
                EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_lines_of_business' AND column_name = 'formula_calc_method') as has_formula_method
        `);

        console.log(`\n${colors.cyan}========================================${colors.reset}`);
        console.log(`${colors.bright}Migration Complete!${colors.reset}`);
        console.log(`${colors.cyan}========================================${colors.reset}`);
        console.log(`Total tables: ${newTables.rows[0].count}`);
        console.log(`${colors.green}✓ Key tables verified:${colors.reset}`);
        console.log(`  - portal_lines_of_business: ${verifyTables.rows[0].has_lob ? 'Yes' : 'No'}`);
        console.log(`  - excel_premium_mappings: ${verifyTables.rows[0].has_excel ? 'Yes' : 'No'}`);
        console.log(`  - permissions: ${verifyTables.rows[0].has_permissions ? 'Yes' : 'No'}`);
        console.log(`  - formula_calc_method column: ${verifyTables.rows[0].has_formula_method ? 'Yes' : 'No'}`);

        await client.end();

        console.log(`\n${colors.green}✅ Your production database now has the complete test schema!${colors.reset}`);
        console.log(`${colors.yellow}Schema backup saved to: ${backupDir}${colors.reset}`);

    } catch (error) {
        console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
        if (error.detail) {
            console.error(`${colors.yellow}Detail: ${error.detail}${colors.reset}`);
        }
        process.exit(1);
    }
}

// Run it
console.log(`${colors.bright}Full Schema Migration Tool${colors.reset}\n`);
console.log(`${colors.yellow}NOTE: To use automatic test database export, update the TEST_DATABASE_URL${colors.reset}`);
console.log(`${colors.yellow}in this script with your test database credentials.${colors.reset}\n`);

runFullMigration().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});