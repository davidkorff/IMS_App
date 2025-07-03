const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
            [email, hashedPassword]
        );

        // Create token
        const token = jwt.sign(
            { user_id: newUser.rows[0].user_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    console.log('Login attempt for:', req.body.email);
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Validate password
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Use the user data we already have
        const userData = {
            user_id: user.rows[0].user_id,
            email: user.rows[0].email,
            name: user.rows[0].full_name,
            role_name: 'admin', // Default role
            permissions: [
                'producer_portal.view',
                'producer_portal.manage',
                'producer_portal.producers.approve',
                'producer_portal.producers.manage',
                'producer_portal.lob.manage'
            ] // Grant all producer portal permissions
        };

        // Create token
        const token = jwt.sign(
            { user_id: userData.user_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ 
            token,
            user: {
                user_id: userData.user_id,
                email: userData.email,
                name: userData.name,
                role: userData.role_name,
                permissions: userData.permissions
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        console.error('Full error details:', err.message);
        console.error('Stack trace:', err.stack);
        console.error('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database (simplified without roles/permissions tables)
        const result = await pool.query(
            `SELECT u.user_id, u.email, u.full_name as name
             FROM users u
             WHERE u.user_id = $1`,
            [decoded.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];
        // For now, give all users full producer portal permissions
        res.json({
            user_id: user.user_id,
            email: user.email,
            name: user.name,
            role: 'admin', // Default role
            permissions: [
                'producer_portal.view',
                'producer_portal.manage',
                'producer_portal.producers.approve',
                'producer_portal.producers.manage',
                'producer_portal.lob.manage'
            ] // Grant all producer portal permissions
        });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        console.error('Error in /me endpoint:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 