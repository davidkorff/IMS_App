const pool = require('./config/db');

async function fixMissingTables() {
    try {
        console.log('Creating missing tables...\n');
        
        // 1. Create system_config table
        console.log('Creating system_config table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ system_config table created\n');
        
        // 2. Create email_configurations table
        console.log('Creating email_configurations table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_configurations (
                config_id SERIAL PRIMARY KEY,
                instance_id INTEGER REFERENCES ims_instances(instance_id) ON DELETE CASCADE,
                email_address VARCHAR(255),
                email_prefix VARCHAR(100),
                email_system_type VARCHAR(20) DEFAULT 'legacy',
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_processed_timestamp TIMESTAMP
            )
        `);
        console.log('✅ email_configurations table created\n');
        
        // 3. Create email_filing_rules table
        console.log('Creating email_filing_rules table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_filing_rules (
                rule_id SERIAL PRIMARY KEY,
                config_id INTEGER REFERENCES email_configurations(config_id) ON DELETE CASCADE,
                rule_name VARCHAR(255) NOT NULL,
                rule_type VARCHAR(50) NOT NULL,
                pattern VARCHAR(500),
                action VARCHAR(50) NOT NULL,
                destination VARCHAR(500),
                priority INTEGER DEFAULT 0,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ email_filing_rules table created\n');
        
        // 4. Create email_filing_logs table
        console.log('Creating email_filing_logs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_filing_logs (
                log_id SERIAL PRIMARY KEY,
                config_id INTEGER REFERENCES email_configurations(config_id),
                email_subject VARCHAR(500),
                email_from VARCHAR(255),
                email_date TIMESTAMP,
                rule_matched VARCHAR(255),
                action_taken VARCHAR(50),
                destination VARCHAR(500),
                status VARCHAR(50),
                error_message TEXT,
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ email_filing_logs table created\n');
        
        // 5. Create subdomain_email_configs table if not exists
        console.log('Creating subdomain_email_configs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subdomain_email_configs (
                config_id SERIAL PRIMARY KEY,
                instance_id INTEGER REFERENCES ims_instances(instance_id) ON DELETE CASCADE,
                email_prefix VARCHAR(100) NOT NULL,
                description TEXT,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(instance_id, email_prefix)
            )
        `);
        console.log('✅ subdomain_email_configs table created\n');
        
        // Check what tables we have now
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'system_config',
                'email_configurations',
                'email_filing_rules',
                'email_filing_logs',
                'subdomain_email_configs'
            )
            ORDER BY table_name
        `);
        
        console.log('Tables created successfully:');
        tables.rows.forEach(row => {
            console.log(`  ✅ ${row.table_name}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Detail:', error.detail);
        process.exit(1);
    }
}

fixMissingTables();