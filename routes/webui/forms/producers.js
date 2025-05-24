const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/auth');
const pool = require('../../../config/db');
const authService = require('../../../services/authService');
const producerService = require('../../../services/producerService');

router.get('/:instanceId', auth, async (req, res) => {
    try {
        const { instanceId } = req.params;

        // Get instance details from database
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const instanceDetails = instance.rows[0];
        const baseUrl = instanceDetails.url.replace(/\/$/, '');
        
        // Get IMS token
        const token = await authService.getToken(
            baseUrl,
            instanceDetails.username,
            instanceDetails.password
        );

        // Get producers
        const producers = await producerService.getProducers(baseUrl, token);
        res.json(producers);

    } catch (err) {
        console.error('Error getting producers:', err);
        res.status(500).json({ 
            message: 'Error getting producers',
            details: err.message 
        });
    }
});

module.exports = router; 