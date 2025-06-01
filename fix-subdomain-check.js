const pool = require('./config/db');

async function fixSubdomainCheck() {
    try {
        console.log('Checking subdomain table setup...\n');
        
        // Check if the subdomain column exists
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ims_instances' 
            AND column_name = 'email_subdomain'
        `);
        
        if (columnCheck.rows.length === 0) {
            console.log('Adding email_subdomain column...');
            await pool.query(`
                ALTER TABLE ims_instances 
                ADD COLUMN email_subdomain VARCHAR(100) UNIQUE
            `);
            console.log('✅ Column added\n');
        } else {
            console.log('✅ email_subdomain column already exists\n');
        }
        
        // Check if reserved_subdomains table exists
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'reserved_subdomains'
        `);
        
        if (tableCheck.rows.length === 0) {
            console.log('Creating reserved_subdomains table...');
            await pool.query(`
                CREATE TABLE reserved_subdomains (
                    subdomain VARCHAR(100) PRIMARY KEY,
                    reason VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Insert reserved subdomains
            await pool.query(`
                INSERT INTO reserved_subdomains (subdomain, reason) VALUES 
                    ('www', 'Reserved for website'),
                    ('mail', 'Reserved for mail server'),
                    ('admin', 'Reserved for administration'),
                    ('api', 'Reserved for API'),
                    ('app', 'Reserved for application'),
                    ('test', 'Reserved for testing'),
                    ('demo', 'Reserved for demos')
            `);
            console.log('✅ Table created and populated\n');
        } else {
            console.log('✅ reserved_subdomains table already exists\n');
        }
        
        console.log('✅ Subdomain system is ready!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // If it's a syntax error, try a simpler approach
        if (error.message.includes('syntax')) {
            console.log('\nTrying simplified approach...');
            try {
                await pool.query('ALTER TABLE ims_instances ADD email_subdomain VARCHAR(100)');
                console.log('✅ Added subdomain column (simplified)');
            } catch (e) {
                if (e.message.includes('already exists')) {
                    console.log('✅ Column already exists');
                } else {
                    console.error('Failed:', e.message);
                }
            }
        }
        process.exit(1);
    }
}

fixSubdomainCheck();