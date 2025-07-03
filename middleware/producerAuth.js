const jwt = require('jsonwebtoken');
const producerAuthService = require('../services/producerAuthService');

/**
 * Middleware to authenticate producer requests
 */
const authenticateProducer = async (req, res, next) => {
    try {
        // Check for JWT token in Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                
                // Ensure this is a producer token
                if (decoded.type !== 'producer') {
                    return res.status(401).json({ error: 'Invalid token type' });
                }

                // Check if session is still valid
                const sessionToken = req.headers['x-session-token'];
                if (sessionToken) {
                    const session = await producerAuthService.validateSession(sessionToken);
                    if (!session) {
                        return res.status(401).json({ error: 'Session expired' });
                    }
                    req.producer = session;
                } else {
                    // Basic producer info from JWT
                    req.producer = {
                        producerId: decoded.producerId,
                        instanceId: decoded.instanceId,
                        email: decoded.email
                    };
                }

                // Add instance ID to request for convenience
                req.instanceId = decoded.instanceId;
                
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        } else {
            return res.status(401).json({ error: 'No token provided' });
        }
    } catch (error) {
        console.error('Producer auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

/**
 * Middleware to optionally authenticate producer (for public routes that can have enhanced features for logged-in users)
 */
const optionalProducerAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                
                if (decoded.type === 'producer') {
                    const sessionToken = req.headers['x-session-token'];
                    if (sessionToken) {
                        const session = await producerAuthService.validateSession(sessionToken);
                        if (session) {
                            req.producer = session;
                            req.instanceId = decoded.instanceId;
                        }
                    }
                }
            } catch (error) {
                // Invalid token is ok for optional auth
            }
        }
        next();
    } catch (error) {
        // Continue without auth
        next();
    }
};

/**
 * Middleware to check if producer has access to a specific line of business
 */
const requireLOBAccess = (lobId) => {
    return async (req, res, next) => {
        if (!req.producer) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        try {
            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            
            const result = await pool.query(`
                SELECT can_quote, can_bind 
                FROM producer_lob_access 
                WHERE producer_id = $1 AND lob_id = $2
            `, [req.producer.producerId, lobId]);

            if (result.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied to this line of business' });
            }

            req.producerLOBAccess = result.rows[0];
            next();
        } catch (error) {
            console.error('LOB access check error:', error);
            return res.status(500).json({ error: 'Access check failed' });
        }
    };
};

/**
 * Get instance ID from subdomain
 */
const getInstanceFromSubdomain = async (req, res, next) => {
    try {
        // Extract subdomain from host
        const host = req.hostname || req.headers.host;
        const subdomain = host.split('.')[0];
        
        if (!subdomain || subdomain === 'www' || subdomain === 'localhost') {
            return res.status(400).json({ error: 'Invalid portal URL' });
        }

        // Get instance from database
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        
        const result = await pool.query(`
            SELECT i.instance_id, i.name, ppc.portal_name, ppc.is_active
            FROM ims_instances i
            LEFT JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
            WHERE LOWER(i.subdomain) = LOWER($1)
        `, [subdomain]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Portal not found' });
        }

        const instance = result.rows[0];
        
        if (!instance.is_active) {
            return res.status(403).json({ error: 'Portal is not active' });
        }

        req.instanceId = instance.instance_id;
        req.instanceInfo = {
            id: instance.instance_id,
            name: instance.name,
            portalName: instance.portal_name || instance.name + ' Producer Portal',
            subdomain: subdomain
        };

        next();
    } catch (error) {
        console.error('Instance lookup error:', error);
        return res.status(500).json({ error: 'Failed to identify portal' });
    }
};

module.exports = {
    authenticateProducer,
    optionalProducerAuth,
    requireLOBAccess,
    getInstanceFromSubdomain
};