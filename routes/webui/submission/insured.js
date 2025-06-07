console.log('Loading insured router - START');

const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/auth');
const pool = require('../../../config/db');
const authService = require('../../../services/authService');
const insuredService = require('../../../services/insuredService');

router.post('/', auth, async (req, res) => {
    console.log('Insured creation request received:', req.body);
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

        const instanceDetails = instance.rows[0];
        const baseUrl = instanceDetails.url.replace(/\/$/, '');
        
        // Get IMS token
        const token = await authService.getToken(
            baseUrl,
            instanceDetails.username,
            instanceDetails.password
        );

        // Create insured with location
        const result = await insuredService.addInsuredWithLocation(
            baseUrl,
            token,
            {
                insuredName: req.body.insuredName,
                businessType: req.body.businessType,
                address1: req.body.address1,
                city: req.body.city,
                state: req.body.state,
                zip: req.body.zip,
                deliveryMethod: req.body.deliveryMethod,
                email: req.body.email
            }
        );

        res.json({
            insuredGuid: result.insuredGuid,
            message: 'Insured created successfully'
        });

    } catch (err) {
        console.error('Insured creation error:', err);
        res.status(500).json({ 
            message: 'Error creating insured',
            details: err.message 
        });
    }
});

console.log('Loading insured router - END');

module.exports = router; 