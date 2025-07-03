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
 * Get instance ID - for testing, use instance 1
 */
const getInstanceFromSubdomain = async (req, res, next) => {
    // For testing, always use instance ID 1
    req.instanceId = 1;
    req.instanceInfo = {
        id: 1,
        name: 'Test Instance',
        portalName: 'Test Producer Portal',
        subdomain: 'test'
    };
    next();
};

module.exports = {
    authenticateProducer,
    getInstanceFromSubdomain
};