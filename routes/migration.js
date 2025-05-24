const router = require('express').Router();
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// Simple migration endpoint (remove after use)
router.get('/run-email-filing-migration', async (req, res) => {
    try {
        console.log('Running email filing migration...');
        
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'migrations', '001_email_filing_tables.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('Migration completed successfully');
        res.json({ 
            success: true, 
            message: 'Email filing tables created successfully' 
        });
        
    } catch (error) {
        console.error('Migration failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Migration failed', 
            error: error.message 
        });
    }
});

module.exports = router;