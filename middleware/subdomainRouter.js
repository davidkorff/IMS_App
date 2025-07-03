const pool = require('../config/db');

/**
 * Middleware to handle subdomain routing for producer portals
 */
const subdomainRouter = async (req, res, next) => {
    // Get subdomain from hostname
    const hostname = req.hostname || req.headers.host;
    const parts = hostname.split('.');
    
    // Skip if no subdomain or if it's www
    if (parts.length < 2 || parts[0] === 'www' || parts[0] === 'localhost') {
        return next();
    }
    
    const subdomain = parts[0];
    
    // Check if this is a producer portal request
    const producerRoutes = [
        '/producer-login',
        '/producer-register', 
        '/producer-dashboard',
        '/producer-submission',
        '/producer-submissions',
        '/api/producer'
    ];
    
    const isProducerRoute = producerRoutes.some(route => req.path.startsWith(route));
    
    if (isProducerRoute) {
        try {
            // Verify subdomain exists and has active portal
            const result = await pool.query(`
                SELECT i.instance_id, i.subdomain, ppc.is_active 
                FROM ims_instances i
                LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
                WHERE i.subdomain = $1
            `, [subdomain]);
            
            if (result.rows.length === 0) {
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