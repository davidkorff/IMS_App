const pool = require('../config/db');

/**
 * Utility function to get instance ID from request
 * Checks in order:
 * 1. req.portalInstance (set by subdomain middleware)
 * 2. Request body/query instanceId
 * 3. Subdomain lookup
 */
async function getInstanceFromRequest(req, instanceIdFromBody = null) {
    let instanceId = instanceIdFromBody;
    
    // First check if we have portal instance from subdomain middleware
    if (!instanceId && req.portalInstance && req.portalInstance.instanceId) {
        instanceId = req.portalInstance.instanceId;
    }
    
    // If still no instance ID, try to get from subdomain
    if (!instanceId) {
        const host = req.hostname || req.headers.host || '';
        const subdomain = host.split('.')[0];
        
        if (subdomain && subdomain !== 'localhost' && subdomain !== 'www' && subdomain !== '42ims') {
            try {
                const result = await pool.query(`
                    SELECT instance_id FROM ims_instances 
                    WHERE LOWER(custom_domain) = LOWER($1)
                    AND is_custom_domain_approved = true
                `, [subdomain]);
                
                if (result.rows.length > 0) {
                    instanceId = result.rows[0].instance_id;
                }
            } catch (error) {
                console.error('Subdomain lookup error:', error);
            }
        }
    }
    
    return instanceId;
}

module.exports = { getInstanceFromRequest };