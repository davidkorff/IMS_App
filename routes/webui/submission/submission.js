const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/auth');
const pool = require('../../../config/db');
const authService = require('../../../services/authService');
const submissionService = require('../../../services/submissionService');

router.post('/', auth, async (req, res) => {
    console.log('Submission creation request received:', req.body);
    try {
        const { instanceId, insuredGuid, producerContactGuid, underwriterGuid } = req.body;
        
        if (!instanceId || !insuredGuid) {
            console.log('Missing required fields:', { instanceId, insuredGuid });
            return res.status(400).json({ message: 'Missing required fields: instanceId, insuredGuid' });
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

        // Create submission
        const result = await submissionService.addSubmission(
            baseUrl,
            token,
            { 
                insuredGuid,
                producerContactGuid: producerContactGuid || "00000000-0000-0000-0000-000000000000",
                underwriterGuid: underwriterGuid || "00000000-0000-0000-0000-000000000000"
            }
        );

        res.json({
            submissionGuid: result.submissionGuid,
            message: 'Submission created successfully'
        });

    } catch (err) {
        console.error('Submission creation error:', err);
        res.status(500).json({ 
            message: 'Error creating submission',
            details: err.message 
        });
    }
});

// Add endpoint to search for producers
router.get('/producers/search', auth, async (req, res) => {
    try {
        const { instanceId, searchString } = req.query;
        
        if (!instanceId || !searchString) {
            return res.status(400).json({ message: 'Missing required parameters: instanceId, searchString' });
        }

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

        // Search for producers
        const producers = await submissionService.searchProducers(baseUrl, token, searchString);

        res.json(producers);

    } catch (err) {
        console.error('Producer search error:', err);
        res.status(500).json({ 
            message: 'Error searching producers',
            details: err.message 
        });
    }
});

module.exports = router; 