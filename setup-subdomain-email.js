const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function setupSubdomainEmail() {
    console.log('🚀 Setting up Subdomain Email System\n');
    
    try {
        // Step 1: Run migration
        console.log('Step 1: Running database migration...');
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '005_subdomain_email_system.sql'), 
            'utf8'
        );
        
        try {
            await pool.query(migrationSQL);
            console.log('✅ Migration completed successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('✅ Tables/columns already exist');
            } else {
                throw error;
            }
        }
        
        // Step 2: Check current instances
        console.log('\nStep 2: Checking existing instances...');
        const instances = await pool.query(`
            SELECT instance_id, name, email_subdomain 
            FROM ims_instances 
            ORDER BY instance_id
        `);
        
        console.log(`Found ${instances.rows.length} instances:`);
        instances.rows.forEach(inst => {
            console.log(`- Instance ${inst.instance_id}: ${inst.name}`);
            console.log(`  Subdomain: ${inst.email_subdomain || 'Not configured'}`);
        });
        
        // Step 3: DNS Setup Instructions
        console.log('\n' + '='.repeat(60));
        console.log('📧 DNS SETUP REQUIRED');
        console.log('='.repeat(60));
        console.log('\nYou need to configure the following DNS records:\n');
        
        console.log('1. WILDCARD MX RECORD:');
        console.log('   Host: *.42consultingllc.com');
        console.log('   Type: MX');
        console.log('   Priority: 10');
        console.log('   Value: [Your mail server that forwards to documents@42consultingllc.com]');
        console.log('');
        
        console.log('2. EMAIL FORWARDING RULE:');
        console.log('   All emails to *.42consultingllc.com should forward to:');
        console.log('   documents@42consultingllc.com');
        console.log('');
        
        console.log('3. SPF RECORD (if not already set):');
        console.log('   Add to your TXT record: "v=spf1 include:[your mail provider] ~all"');
        console.log('');
        
        console.log('='.repeat(60));
        console.log('');
        
        // Step 4: Test the setup
        console.log('Step 4: System Configuration...');
        
        // Update server.js to use new email processor
        console.log('\n⚠️  IMPORTANT: Update server.js to use emailProcessorV2:');
        console.log('   Change: const emailProcessor = require(\'./services/emailProcessor\');');
        console.log('   To:     const emailProcessor = require(\'./services/emailProcessorV2\');');
        
        console.log('\n✅ Subdomain Email System Setup Complete!');
        console.log('\nNext Steps:');
        console.log('1. Configure DNS records as shown above');
        console.log('2. Update server.js to use emailProcessorV2');
        console.log('3. Deploy the changes');
        console.log('4. Test by creating a new email configuration');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

setupSubdomainEmail();