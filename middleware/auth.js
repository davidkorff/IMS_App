const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async function(req, res, next) {
    console.log('Auth middleware - checking token');
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // Check if no token
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);
        
        // Fetch user data from database
        const result = await pool.query(
            'SELECT user_id, email, full_name FROM users WHERE user_id = $1',
            [decoded.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Add user to request
        req.user = {
            user_id: result.rows[0].user_id,  // Changed from userId to user_id for consistency
            userId: result.rows[0].user_id,    // Keep both for backward compatibility
            email: result.rows[0].email,
            name: result.rows[0].full_name,
            // Grant all producer portal permissions for now
            permissions: [
                'producer_portal.view',
                'producer_portal.manage',
                'producer_portal.producers.approve',
                'producer_portal.producers.manage',
                'producer_portal.lob.manage'
            ]
        };
        
        next();
    } catch (err) {
        console.error('Token verification failed:', err);
        res.status(401).json({ message: 'Token is not valid' });
    }
}; 