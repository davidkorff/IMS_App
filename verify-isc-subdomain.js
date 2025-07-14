const pool = require('./config/db');

async function verifyISCSubdomain() {
    try {
        console.log('🔍 Checking ISC subdomain configuration...\n');

        // First, check the current state of instance 13 (ISC)
        const instanceCheck = await pool.query(`
            SELECT 
                i.instance_id,
                i.instance_name,
                i.custom_domain,
                i.is_custom_domain_approved,
                ppc.portal_subdomain,
                ppc.is_active as portal_active,
                ppc.enable_self_registration
            FROM ims_instances i
            LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
            WHERE i.instance_id = 13
        `);

        if (instanceCheck.rows.length === 0) {
            console.log('❌ Instance 13 not found!');
            return;
        }

        const instance = instanceCheck.rows[0];
        console.log('📊 Current configuration for Instance 13 (ISC):');
        console.log('Instance Name:', instance.instance_name);
        console.log('Custom Domain:', instance.custom_domain || 'NOT SET');
        console.log('Domain Approved:', instance.is_custom_domain_approved || false);
        console.log('Portal Subdomain:', instance.portal_subdomain || 'NOT SET');
        console.log('Portal Active:', instance.portal_active || false);
        console.log('Self Registration:', instance.enable_self_registration || false);
        console.log('\n');

        // Check what the subdomain router would find
        const subdomainCheck = await pool.query(`
            SELECT 
                i.instance_id, 
                i.custom_domain as subdomain, 
                ppc.is_active 
            FROM ims_instances i
            LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
            WHERE i.custom_domain = 'isc' 
              AND i.is_custom_domain_approved = true
              AND (ppc.is_active = true OR ppc.is_active IS NULL)
        `);

        console.log('🔍 Subdomain router query results:');
        if (subdomainCheck.rows.length === 0) {
            console.log('❌ No results - subdomain router would NOT find ISC subdomain');
            console.log('\n🔧 Issues found:');
            
            if (instance.custom_domain !== 'isc') {
                console.log('  - custom_domain is not set to "isc"');
            }
            if (!instance.is_custom_domain_approved) {
                console.log('  - is_custom_domain_approved is not true');
            }
            if (!instance.portal_active) {
                console.log('  - portal is not active');
            }
        } else {
            console.log('✅ Subdomain router would find:', subdomainCheck.rows[0]);
        }

        // Check DNS configuration
        console.log('\n📡 DNS Configuration Requirements:');
        console.log('For isc.42ims.com to work, you need:');
        console.log('1. DNS CNAME record: isc.42ims.com -> your-server.com');
        console.log('2. Web server configured to accept requests for isc.42ims.com');
        console.log('3. SSL certificate that covers *.42ims.com or specifically isc.42ims.com');

        // Provide fix suggestions
        if (instance.custom_domain !== 'isc' || !instance.is_custom_domain_approved || !instance.portal_active) {
            console.log('\n🛠️  To fix the configuration, run the following SQL:');
            console.log('```sql');
            
            if (instance.custom_domain !== 'isc' || !instance.is_custom_domain_approved) {
                console.log(`UPDATE ims_instances 
SET custom_domain = 'isc', 
    is_custom_domain_approved = true 
WHERE instance_id = 13;`);
            }
            
            if (!instance.portal_active) {
                console.log(`
-- Ensure producer portal config exists
INSERT INTO producer_portal_config (
    instance_id, 
    portal_subdomain, 
    portal_name, 
    is_active, 
    enable_self_registration
) VALUES (
    13, 
    'isc', 
    'ISC Producer Portal', 
    true, 
    true
)
ON CONFLICT (instance_id) 
DO UPDATE SET 
    is_active = true,
    portal_subdomain = 'isc';`);
            }
            console.log('```');
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

verifyISCSubdomain();