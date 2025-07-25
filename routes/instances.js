const router = require('express').Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Create IMS instance
router.post('/', auth, async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] POST /api/instances - Starting request`);
    console.log(`[${requestId}] Request body:`, req.body);
    console.log(`[${requestId}] User:`, req.user);
    
    try {
        const { name, url, userName, password, customDomain } = req.body;
        const userId = req.user.user_id;
        console.log(`[${requestId}] Using userId for creation:`, userId);

        // Validate customDomain is provided
        if (!customDomain) {
            return res.status(400).json({ 
                message: 'Requested subdomain is required' 
            });
        }

        // Check if instance already exists for this user
        const existing = await pool.query(
            'SELECT * FROM ims_instances WHERE user_id = $1 AND name = $2',
            [userId, name]
        );

        if (existing.rows.length > 0) {
            console.log(`[${requestId}] Instance already exists`);
            return res.status(400).json({ message: 'Instance with this name already exists' });
        }

        // Format the custom domain
        const formattedDomain = customDomain
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .replace(/^-+|-+$/g, '');

        // Check if custom domain is already in use
        const domainInUse = await pool.query(
            'SELECT * FROM ims_instances WHERE custom_domain = $1',
            [formattedDomain]
        );

        if (domainInUse.rows.length > 0) {
            return res.status(400).json({ 
                message: `Domain identifier "${formattedDomain}" is already in use` 
            });
        }

        // For backward compatibility, also set email_subdomain to the same value
        const subdomain = formattedDomain;

        const newInstance = await pool.query(
            'INSERT INTO ims_instances (user_id, name, url, username, password, email_subdomain, custom_domain, is_custom_domain_approved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [userId, name, url, userName, password, subdomain, formattedDomain, false]
        );

        console.log(`[${requestId}] Created instance:`, newInstance.rows[0]);
        res.json(newInstance.rows[0]);
    } catch (err) {
        console.error(`[${requestId}] Error creating instance:`, err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all instances for user
router.get('/', auth, async (req, res) => {
    console.log('GET /api/instances - Fetching instances for user:', req.user);
    try {
        const userId = req.user.user_id;
        console.log('Using userId:', userId);
        
        const instances = await pool.query(
            'SELECT * FROM ims_instances WHERE user_id = $1',
            [userId]
        );

        console.log('Found instances:', instances.rows);
        res.json(instances.rows);
    } catch (err) {
        console.error('Error fetching instances:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete an instance
router.delete('/:id', auth, async (req, res) => {
    console.log('DELETE /api/instances/:id - Deleting instance:', req.params.id);
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        // First check if the instance belongs to the user
        const instance = await pool.query(
            'DELETE FROM ims_instances WHERE instance_id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        console.log('Delete result:', instance.rows);
        if (instance.rows.length === 0) {
            console.log('Instance not found or not authorized');
            return res.status(404).json({ message: 'Instance not found or not authorized' });
        }

        res.json({ message: 'Instance deleted successfully' });
    } catch (err) {
        console.error('Error deleting instance:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single instance
router.get('/:id', auth, async (req, res) => {
    console.log('GET /api/instances/:id - Fetching instance:', req.params.id);
    try {
        const { id } = req.params;
        const userId = req.user.user_id;

        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Check if instance has email configuration
        const emailConfig = await pool.query(
            'SELECT * FROM email_configurations WHERE instance_id = $1',
            [id]
        );

        const instanceData = instance.rows[0];
        
        // Update email_status based on actual configuration existence
        if (emailConfig.rows.length > 0) {
            instanceData.email_status = 'active';
        } else {
            instanceData.email_status = 'not_configured';
        }

        console.log('Found instance with email_status:', instanceData);
        res.json({ success: true, instance: instanceData });
    } catch (err) {
        console.error('Error fetching instance:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get active producer portals (public endpoint)
router.get('/active-portals', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.instance_id,
                i.name,
                i.subdomain,
                ppc.portal_name,
                ppc.is_active
            FROM ims_instances i
            INNER JOIN producer_portal_config ppc ON i.instance_id = ppc.instance_id
            WHERE ppc.is_active = true
            ORDER BY i.name
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching active portals:', err);
        res.status(500).json({ message: 'Failed to fetch portals' });
    }
});

module.exports = router;