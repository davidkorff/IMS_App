const pool = require('./config/db');

async function checkAndFixSubdomain() {
    try {
        console.log('Checking subdomain system setup...\n');
        
        // 1. Check if subdomain column exists on ims_instances
        const subdomainCol = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ims_instances' 
            AND column_name = 'email_subdomain'
        `);
        
        if (subdomainCol.rows.length === 0) {
            console.log('❌ Missing email_subdomain column');
            console.log('Adding column...');
            try {
                await pool.query('ALTER TABLE ims_instances ADD COLUMN email_subdomain VARCHAR(100)');
                console.log('✅ Column added');
            } catch (e) {
                console.error('Failed to add column:', e.message);
            }
        } else {
            console.log('✅ email_subdomain column exists');
        }
        
        // 2. Check if reserved_subdomains table exists
        const reservedTable = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'reserved_subdomains'
        `);
        
        if (reservedTable.rows.length === 0) {
            console.log('❌ Missing reserved_subdomains table');
            console.log('Creating table...');
            try {
                await pool.query(`
                    CREATE TABLE reserved_subdomains (
                        subdomain VARCHAR(100) PRIMARY KEY,
                        reason VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Add some basic reserved subdomains
                await pool.query(`
                    INSERT INTO reserved_subdomains (subdomain, reason) 
                    SELECT subdomain, reason FROM (VALUES 
                        ('www', 'Reserved'),
                        ('mail', 'Reserved'),
                        ('admin', 'Reserved'),
                        ('api', 'Reserved'),
                        ('test', 'Reserved')
                    ) AS t(subdomain, reason)
                    WHERE NOT EXISTS (
                        SELECT 1 FROM reserved_subdomains WHERE subdomain = t.subdomain
                    )
                `);
                console.log('✅ Table created and populated');
            } catch (e) {
                console.error('Failed to create table:', e.message);
            }
        } else {
            console.log('✅ reserved_subdomains table exists');
        }
        
        // 3. Check current instances
        console.log('\nCurrent instances:');
        const instances = await pool.query(`
            SELECT instance_id, name, email_subdomain 
            FROM ims_instances 
            ORDER BY instance_id
        `);
        
        instances.rows.forEach(row => {
            console.log(`  ID: ${row.instance_id}, Name: ${row.name}, Subdomain: ${row.email_subdomain || '(none)'}`);
        });
        
        // 4. Test subdomain check query
        console.log('\nTesting subdomain availability check...');
        const testSubdomain = 'test-subdomain';
        
        try {
            const available = await pool.query(`
                SELECT 
                    NOT EXISTS (
                        SELECT 1 FROM ims_instances WHERE LOWER(email_subdomain) = LOWER($1)
                    ) AND
                    NOT EXISTS (
                        SELECT 1 FROM reserved_subdomains WHERE LOWER(subdomain) = LOWER($1)
                    ) AS available
            `, [testSubdomain]);
            
            console.log(`✅ Subdomain check works! "${testSubdomain}" is ${available.rows[0].available ? 'available' : 'not available'}`);
        } catch (e) {
            console.error('❌ Subdomain check failed:', e.message);
        }
        
        console.log('\nDone! You should now be able to add instances with subdomains.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAndFixSubdomain();