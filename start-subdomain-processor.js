// Script to switch from plus addressing to subdomain email processing
const pool = require('./config/db');

async function switchToSubdomainProcessing() {
    console.log('=== SWITCHING TO SUBDOMAIN EMAIL PROCESSING ===');
    
    try {
        // 1. Check if we have the catch-all processor
        const catchAllProcessor = require('./services/catchAllEmailProcessor');
        console.log('✅ Catch-all processor loaded');
        
        // 2. Check current email configurations
        const configs = await pool.query(`
            SELECT 
                ec.id,
                ec.email_address,
                ec.email_system_type,
                ii.name as instance_name,
                ii.email_subdomain
            FROM email_configurations ec
            JOIN ims_instances ii ON ec.instance_id = ii.instance_id
            WHERE ii.email_status = 'active'
        `);
        
        console.log(`\nFound ${configs.rows.length} active email configurations:`);
        configs.rows.forEach(config => {
            console.log(`  - ${config.instance_name}: ${config.email_address} (${config.email_system_type})`);
        });
        
        // 3. Check how many are using subdomain vs plus addressing
        const subdomainConfigs = configs.rows.filter(c => c.email_system_type === 'subdomain');
        const plusConfigs = configs.rows.filter(c => c.email_system_type !== 'subdomain');
        
        console.log(`\nConfiguration types:`);
        console.log(`  - Subdomain: ${subdomainConfigs.length}`);
        console.log(`  - Plus/Legacy: ${plusConfigs.length}`);
        
        // 4. Start the catch-all processor
        console.log('\nStarting catch-all email processor...');
        catchAllProcessor.startProcessing(5); // Check every 5 minutes
        
        console.log('✅ Subdomain email processing is now active!');
        console.log('\nEmails sent to subdomain addresses (e.g., docs@isctest.42consultingllc.com)');
        console.log('will be processed from the catch-all inbox: documents@42consultingllc.com');
        
    } catch (error) {
        console.error('❌ Error switching to subdomain processing:', error);
        process.exit(1);
    }
}

// Run the switch
switchToSubdomainProcessing();