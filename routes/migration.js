const router = require('express').Router();
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// Run full database setup (base schema + email filing)
router.get('/setup-full-database', async (req, res) => {
    try {
        console.log('Setting up full database...');
        
        // First create base tables manually (since schema.sql has encoding issues)
        const baseSchema = `
        -- Create base tables
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ims_instances (
            instance_id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            url VARCHAR(255) NOT NULL,
            username VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ims_reports (
            report_id SERIAL PRIMARY KEY,
            instance_id INTEGER REFERENCES ims_instances(instance_id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            procedure_name VARCHAR(255) NOT NULL,
            parameters JSONB DEFAULT '{}',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        // Execute base schema
        await pool.query(baseSchema);
        console.log('Base schema created');
        
        // Then read and execute email filing migration
        const migrationPath = path.join(__dirname, '..', 'migrations', '001_email_filing_tables.sql');
        const emailFilingSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await pool.query(emailFilingSQL);
        console.log('Email filing tables created');
        
        res.json({ 
            success: true, 
            message: 'Full database setup completed successfully' 
        });
        
    } catch (error) {
        console.error('Database setup failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database setup failed', 
            error: error.message 
        });
    }
});

// Just email filing migration (if base tables exist)
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

// Run billing and usage tracking migration
router.get('/run-billing-migration', async (req, res) => {
    try {
        console.log('Running billing and usage tracking migration...');
        
        // Read the billing migration file
        const migrationPath = path.join(__dirname, '..', 'migrations', '002_billing_and_usage.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('Billing migration completed successfully');
        res.json({ 
            success: true, 
            message: 'Billing and usage tracking tables created successfully' 
        });
        
    } catch (error) {
        console.error('Billing migration failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Billing migration failed', 
            error: error.message 
        });
    }
});

// Run complete setup (base + email filing + billing)
router.get('/setup-complete-database', async (req, res) => {
    try {
        console.log('Setting up complete database with billing...');
        
        // First create base tables manually (since schema.sql has encoding issues)
        const baseSchema = `
        -- Create base tables
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ims_instances (
            instance_id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            url VARCHAR(255) NOT NULL,
            username VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ims_reports (
            report_id SERIAL PRIMARY KEY,
            instance_id INTEGER REFERENCES ims_instances(instance_id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            procedure_name VARCHAR(255) NOT NULL,
            parameters JSONB DEFAULT '{}',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `;

        // Execute base schema
        await pool.query(baseSchema);
        console.log('Base schema created');
        
        // Run email filing migration
        const emailFilingPath = path.join(__dirname, '..', 'migrations', '001_email_filing_tables.sql');
        const emailFilingSQL = fs.readFileSync(emailFilingPath, 'utf8');
        await pool.query(emailFilingSQL);
        console.log('Email filing tables created');
        
        // Run billing migration
        const billingPath = path.join(__dirname, '..', 'migrations', '002_billing_and_usage.sql');
        const billingSQL = fs.readFileSync(billingPath, 'utf8');
        await pool.query(billingSQL);
        console.log('Billing and usage tracking tables created');
        
        res.json({ 
            success: true, 
            message: 'Complete database setup with billing completed successfully' 
        });
        
    } catch (error) {
        console.error('Complete database setup failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Complete database setup failed', 
            error: error.message 
        });
    }
});

// Run email configuration migration
router.get('/run-email-config-migration', async (req, res) => {
    try {
        console.log('Running email configuration migration...');
        
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '..', 'migrations', '003_email_configuration.sql'), 
            'utf8'
        );
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('Email configuration migration completed!');
        
        res.json({
            success: true,
            message: 'Email configuration migration completed',
            migration: '003_email_configuration.sql'
        });
    } catch (error) {
        console.error('Email configuration migration error:', error);
        res.status(500).json({
            success: false,
            message: 'Email configuration migration failed',
            error: error.message
        });
    }
});

// Run last processed timestamp migration
router.get('/run-last-processed-migration', async (req, res) => {
    try {
        console.log('Running last processed timestamp migration...');
        
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '..', 'migrations', '004_add_last_processed_timestamp.sql'), 
            'utf8'
        );
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('Last processed timestamp migration completed!');
        
        res.json({
            success: true,
            message: 'Last processed timestamp migration completed',
            migration: '004_add_last_processed_timestamp.sql'
        });
    } catch (error) {
        console.error('Last processed timestamp migration error:', error);
        res.status(500).json({
            success: false,
            message: 'Last processed timestamp migration failed',
            error: error.message
        });
    }
});

module.exports = router;