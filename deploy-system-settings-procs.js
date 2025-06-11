const sql = require('mssql');
const fs = require('fs').promises;
const path = require('path');

// Configuration for your IMS instance database
const config = {
    user: process.env.IMS_DB_USER || 'your_username',
    password: process.env.IMS_DB_PASSWORD || 'your_password',
    server: process.env.IMS_DB_SERVER || 'your_server',
    database: process.env.IMS_DB_DATABASE || 'your_database',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function deployStoredProcedures() {
    let pool;
    
    try {
        // Read the SQL file
        const sqlFilePath = path.join(__dirname, 'migrations', '013_system_settings_procedures.sql');
        const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
        
        // Connect to database
        console.log('Connecting to IMS database...');
        pool = await sql.connect(config);
        
        // Split the SQL content by GO statements
        const sqlStatements = sqlContent.split(/\nGO\r?\n/).filter(stmt => stmt.trim());
        
        // Execute each statement
        for (let i = 0; i < sqlStatements.length; i++) {
            const statement = sqlStatements[i].trim();
            if (statement && !statement.startsWith('--')) {
                console.log(`Executing statement ${i + 1}/${sqlStatements.length}...`);
                try {
                    await pool.request().query(statement);
                } catch (err) {
                    console.error(`Error executing statement ${i + 1}:`, err.message);
                    throw err;
                }
            }
        }
        
        console.log('✅ Stored procedures deployed successfully!');
        
        // Test the procedures
        console.log('\nTesting DK_SystemSettings_GetAll_WS...');
        const testResult = await pool.request().execute('DK_SystemSettings_GetAll_WS');
        console.log(`Found ${testResult.recordset.length} settings`);
        
    } catch (err) {
        console.error('❌ Error deploying stored procedures:', err);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Show usage if no environment variables are set
if (!process.env.IMS_DB_SERVER) {
    console.log(`
Usage: Set the following environment variables before running this script:
  IMS_DB_SERVER     - SQL Server hostname/IP
  IMS_DB_DATABASE   - Database name
  IMS_DB_USER       - SQL username
  IMS_DB_PASSWORD   - SQL password

Example:
  IMS_DB_SERVER=myserver.database.windows.net \\
  IMS_DB_DATABASE=IMSProd \\
  IMS_DB_USER=sa \\
  IMS_DB_PASSWORD=mypassword \\
  node deploy-system-settings-procs.js

Or modify the config object in this script directly.
`);
    process.exit(0);
}

// Run the deployment
deployStoredProcedures();