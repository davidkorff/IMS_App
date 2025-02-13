console.log('Loading clearance router - START');

const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/auth');
const pool = require('../../../config/db');
const soap = require('soap');
const { getIMSToken } = require('../../../utils/ims');

// Add logging to track request
router.post('/', auth, async (req, res) => {
    console.log('Clearance check request received:', req.body);
    try {
        const { instanceId, insuredName } = req.body;
        
        if (!instanceId || !insuredName) {
            console.log('Missing required fields:', { instanceId, insuredName });
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Get instance details from database
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            console.log('Instance not found:', instanceId);
            return res.status(404).json({ message: 'Instance not found' });
        }

        console.log('Instance found:', instance.rows[0]);

        // Call IMS clearance check
        // TODO: Implement actual clearance check logic here
        
        // For now, return a mock response
        res.json({ 
            match: false,
            insuredGuid: null,
            clearanceData: []
        });

    } catch (err) {
        console.error('Clearance check error:', err);
        res.status(500).json({ 
            message: 'Error performing clearance check',
            details: err.message 
        });
    }
});

console.log('Loading clearance router - END');

module.exports = router; 