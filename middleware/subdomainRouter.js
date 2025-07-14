const pool = require('../config/db');

/**
 * Middleware to handle subdomain routing for producer portals
 */
const subdomainRouter = async (req, res, next) => {
    // Get subdomain from hostname
    let hostname = req.hostname || req.headers.host;
    
    // Remove port if present
    if (hostname.includes(':')) {
        hostname = hostname.split(':')[0];
    }
    
    const parts = hostname.split('.');
    
    console.log('🔍 Subdomain Router - Hostname:', hostname, 'Path:', req.path);
    
    // For localhost development, check if first part is not 'localhost'
    const isLocalhost = hostname.includes('localhost');
    
    // Define your main domain (without subdomain)
    const mainDomain = '42ims.com';
    const isMainDomain = hostname === mainDomain || hostname === `www.${mainDomain}`;
    
    const hasSubdomain = isLocalhost ? 
        (parts.length >= 2 && parts[0] !== 'localhost') : 
        (parts.length > 2 && !isMainDomain);
    
    console.log('🔍 Subdomain check - Parts:', parts, 'Has subdomain:', hasSubdomain);
    
    // Skip if no subdomain or if it's www
    if (!hasSubdomain || parts[0] === 'www') {
        return next();
    }
    
    const subdomain = parts[0];
    console.log('📍 Detected subdomain:', subdomain);
    
    // For producer portal subdomains, redirect root to producer login
    if (req.path === '/' || req.path === '') {
        req.url = '/producer-login';
    }
    
    // Check if this is a producer portal request
    const producerRoutes = [
        '/producer-login',
        '/producer-register', 
        '/producer-dashboard',
        '/producer-submission',
        '/producer-submissions',
        '/api/producer',
        '/producer-portal'
    ];
    
    const isProducerRoute = producerRoutes.some(route => req.path.startsWith(route)) || req.path === '/';
    
    if (isProducerRoute) {
        console.log('🚀 Producer route detected for subdomain:', subdomain);
        try {
            // Verify subdomain exists and has active portal
            const result = await pool.query(`
                SELECT i.instance_id, i.custom_domain as subdomain, ppc.is_active 
                FROM ims_instances i
                LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
                WHERE i.custom_domain = $1 
                  AND i.is_custom_domain_approved = true
                  AND (ppc.is_active = true OR ppc.is_active IS NULL)
            `, [subdomain]);
            
            console.log('📊 Query result:', result.rows);
            
            if (result.rows.length === 0) {
                console.log('❌ No portal found for subdomain:', subdomain);
                return res.status(404).send('Portal not found');
            }
            
            const instance = result.rows[0];
            
            // Check if portal is configured and active
            if (!instance.is_active) {
                return res.status(404).send('Portal is not active. Please contact your administrator.');
            }
            
            // Add instance info to request
            req.portalInstance = {
                instanceId: instance.instance_id,
                subdomain: instance.subdomain
            };
        } catch (error) {
            console.error('Subdomain routing error:', error);
            return res.status(500).send('Error loading portal');
        }
    }
    
    next();
};

module.exports = subdomainRouter;