const router = require('express').Router();
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// Temporary fix endpoint - REMOVE AFTER RUNNING
router.get('/run-fixes', async (req, res) => {
    try {
        console.log('Running email fixes...');
        
        // Run migration
        try {
            const migrationSQL = fs.readFileSync(
                path.join(__dirname, '..', 'migrations', '004_add_last_processed_timestamp.sql'), 
                'utf8'
            );
            await pool.query(migrationSQL);
        } catch (error) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }
        
        // Fix email status
        await pool.query(`
            UPDATE ims_instances 
            SET email_status = 'active'
            WHERE instance_id IN (
                SELECT DISTINCT instance_id 
                FROM email_configurations
            )
            AND (email_status IS NULL OR email_status = 'not_configured')
        `);
        
        res.json({
            success: true,
            message: 'Email fixes applied successfully! Please refresh your browser.'
        });
    } catch (error) {
        console.error('Fix failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;