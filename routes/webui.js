const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const authService = require('../services/authService');
const dataAccess = require('../services/dataAccess');

router.get('/:id/webui', auth, async (req, res) => {
    try {
        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [req.params.id, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get IMS token using authService
        const imsToken = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        // Send JSON response instead of rendering
        res.json({ 
            instance: instance.rows[0],
            imsToken: imsToken
        });

    } catch (err) {
        console.error('Error accessing web UI:', err);
        res.status(500).json({ message: 'Error accessing IMS Web Interface' });
    }
});

// API endpoint for getting instance data with IMS token
router.get('/api/instances/:id/webui', auth, async (req, res) => {
    try {
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [req.params.id, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get IMS token
        const imsToken = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        res.json({
            ...instance.rows[0],
            imsToken
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/search', auth, async (req, res) => {
    try {
        const { instanceId, controlNo, customerName } = req.body;
        
        console.log('Received parameters:', { controlNo, customerName });

        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Build parameters object - only include parameters that were sent
        const parameters = {};
        if (controlNo !== undefined) {
            parameters.controlno = controlNo;
        }
        if (customerName !== undefined) {
            parameters.customername = customerName;
        }

        console.log('Executing procedure with parameters:', parameters);

        // Call the stored procedure using dataAccess service
        const results = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_Submission_Search_WS',
            parameters
        });

        console.log('Result count:', results.Table?.length || 0);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ message: 'Error searching policies' });
    }
});

module.exports = router; 