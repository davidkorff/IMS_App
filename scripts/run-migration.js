const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runMigration() {
    const migrationFile = process.argv[2];
    
    if (!migrationFile) {
        console.error('Usage: node scripts/run-migration.js <migration-file>');
        process.exit(1);
    }
    
    const filePath = path.join(__dirname, '..', 'migrations', migrationFile);
    
    if (!fs.existsSync(filePath)) {
        console.error(`Migration file not found: ${filePath}`);
        process.exit(1);
    }
    
    try {
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`Running migration: ${migrationFile}`);
        
        await pool.query(sql);
        
        console.log(`Migration completed successfully: ${migrationFile}`);
        process.exit(0);
    } catch (error) {
        console.error(`Migration failed: ${error.message}`);
        process.exit(1);
    }
}

runMigration();