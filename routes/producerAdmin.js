const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const producerManagementService = require('../services/producerManagementService');
const pool = require('../config/db');

// All routes require authentication and appropriate permissions
router.use(auth);

// Middleware to check producer portal permissions - DISABLED for now
const requirePermission = (permission) => {
    return (req, res, next) => {
        // Skip permission check for now
        next();
    };
};

// Get producer portal configuration
router.get('/config', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        
        console.log('Getting portal config for instanceId:', instanceId);
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        const result = await pool.query(`
            SELECT ppc.*, i.custom_domain, i.is_custom_domain_approved
            FROM producer_portal_config ppc
            JOIN ims_instances i ON ppc.instance_id = i.instance_id
            WHERE ppc.instance_id = $1
        `, [instanceId]);

        console.log('Portal config query result:', result.rows.length, 'rows');
        if (result.rows.length > 0) {
            console.log('Config data:', result.rows[0]);
        }

        if (result.rows.length === 0) {
            // Get custom_domain from instance
            const instanceResult = await pool.query(`
                SELECT custom_domain, is_custom_domain_approved 
                FROM ims_instances WHERE instance_id = $1
            `, [instanceId]);
            
            // Return empty config instead of 404
            return res.json({
                instance_id: instanceId,
                portal_name: '',
                logo_url: '',
                primary_color: '#007bff',
                secondary_color: '#6c757d',
                custom_css: '',
                welcome_message: '',
                is_active: false,
                subdomain: instanceResult.rows[0]?.subdomain || null,
                custom_domain: instanceResult.rows[0]?.custom_domain || null,
                is_custom_domain_approved: instanceResult.rows[0]?.is_custom_domain_approved || false
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching portal config:', error);
        res.status(500).json({ error: 'Failed to fetch portal configuration' });
    }
});

// Update producer portal configuration
router.put('/config', async (req, res) => {
    try {
        const {
            instanceId,
            portal_name,
            logo_url,
            primary_color,
            secondary_color,
            custom_css,
            welcome_message,
            terms_of_service,
            is_active
        } = req.body;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }

        const result = await pool.query(`
            INSERT INTO producer_portal_config (
                instance_id, portal_name, logo_url, primary_color, 
                secondary_color, custom_css, welcome_message, 
                terms_of_service, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (instance_id) 
            DO UPDATE SET 
                portal_name = COALESCE(EXCLUDED.portal_name, producer_portal_config.portal_name),
                logo_url = COALESCE(EXCLUDED.logo_url, producer_portal_config.logo_url),
                primary_color = COALESCE(EXCLUDED.primary_color, producer_portal_config.primary_color),
                secondary_color = COALESCE(EXCLUDED.secondary_color, producer_portal_config.secondary_color),
                custom_css = COALESCE(EXCLUDED.custom_css, producer_portal_config.custom_css),
                welcome_message = COALESCE(EXCLUDED.welcome_message, producer_portal_config.welcome_message),
                terms_of_service = COALESCE(EXCLUDED.terms_of_service, producer_portal_config.terms_of_service),
                is_active = COALESCE(EXCLUDED.is_active, producer_portal_config.is_active),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            instanceId, portal_name, logo_url, primary_color, secondary_color,
            custom_css, welcome_message, terms_of_service, is_active
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating portal config:', error);
        res.status(500).json({ error: 'Failed to update portal configuration' });
    }
});

// Get all producers
router.get('/producers', requirePermission('producer_portal.producers.view'), async (req, res) => {
    try {
        const { status, search, instanceId } = req.query;
        const filters = { status, search };

        // Use instanceId from query if provided, otherwise fall back to user's instanceId
        const targetInstanceId = instanceId || req.user.instanceId;
        
        if (!targetInstanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }

        console.log('Fetching producers for instance:', targetInstanceId, 'with filters:', filters);
        
        const producers = await producerManagementService.getProducers(
            targetInstanceId,
            filters
        );
        
        console.log('Found producers:', producers.length);

        res.json(producers);
    } catch (error) {
        console.error('Error fetching producers:', error);
        res.status(500).json({ error: 'Failed to fetch producers' });
    }
});

// Get producer details
router.get('/producers/:producerId', requirePermission('producer_portal.producers.view'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { instanceId } = req.query;
        const targetInstanceId = instanceId || req.user.instanceId;

        const details = await producerManagementService.getProducerDetails(
            producerId,
            targetInstanceId
        );

        if (!details) {
            return res.status(404).json({ error: 'Producer not found' });
        }

        res.json(details);
    } catch (error) {
        console.error('Error fetching producer details:', error);
        res.status(500).json({ error: 'Failed to fetch producer details' });
    }
});

// Approve producer
router.post('/producers/:producerId/approve', requirePermission('producer_portal.producers.approve'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { instanceId } = req.query;
        const { lobAccess } = req.body;
        const targetInstanceId = instanceId || req.user.instanceId;

        const result = await producerManagementService.approveProducer(
            producerId,
            targetInstanceId,
            req.user.user_id || req.user.userId,
            lobAccess
        );

        res.json({
            success: true,
            producer: result
        });
    } catch (error) {
        console.error('Error approving producer:', error);
        if (error.message === 'Producer not found or already processed') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to approve producer' });
    }
});

// Reject producer
router.post('/producers/:producerId/reject', requirePermission('producer_portal.producers.approve'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { instanceId } = req.query;
        const { reason } = req.body;
        const targetInstanceId = instanceId || req.user.instanceId;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason required' });
        }

        const result = await producerManagementService.rejectProducer(
            producerId,
            targetInstanceId,
            req.user.user_id || req.user.userId,
            reason
        );

        res.json({
            success: true,
            producer: result
        });
    } catch (error) {
        console.error('Error rejecting producer:', error);
        res.status(500).json({ error: 'Failed to reject producer' });
    }
});

// Update producer status
router.put('/producers/:producerId/status', requirePermission('producer_portal.producers.manage'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { status, reason } = req.body;

        const result = await producerManagementService.updateProducerStatus(
            producerId,
            req.user.instanceId,
            status,
            req.user.userId,
            reason
        );

        res.json({
            success: true,
            producer: result
        });
    } catch (error) {
        console.error('Error updating producer status:', error);
        res.status(500).json({ error: 'Failed to update producer status' });
    }
});

// Update producer LOB access
router.put('/producers/:producerId/lob-access', requirePermission('producer_portal.producers.manage'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { lobAccess } = req.body;

        if (!Array.isArray(lobAccess)) {
            return res.status(400).json({ error: 'lobAccess must be an array' });
        }

        await producerManagementService.updateProducerLOBAccess(
            producerId,
            req.user.instanceId,
            lobAccess
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating LOB access:', error);
        res.status(500).json({ error: 'Failed to update LOB access' });
    }
});

// Get lines of business
router.get('/lines-of-business', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }
        
        const result = await pool.query(`
            SELECT * FROM portal_lines_of_business
            WHERE instance_id = $1
            ORDER BY display_order, line_name
        `, [instanceId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching lines of business:', error);
        res.status(500).json({ error: 'Failed to fetch lines of business' });
    }
});

// Create line of business
router.post('/lines-of-business', requirePermission('producer_portal.lob.manage'), async (req, res) => {
    try {
        const {
            instanceId,
            line_name,
            line_code,
            description,
            ims_line_guid,
            ims_company_guid,
            ims_procedure_id,
            ims_procedure_name,
            ims_company_location_guid,
            ims_quoting_location_guid,
            ims_issuing_location_guid,
            rater_template_path,
            rater_config,
            min_premium,
            max_premium,
            auto_bind_limit,
            requires_underwriter_approval,
            display_order,
            form_config
        } = req.body;
        
        // Validate instanceId
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }

        const result = await pool.query(`
            INSERT INTO portal_lines_of_business (
                instance_id, line_name, line_code, description,
                ims_line_guid, ims_company_guid, ims_procedure_name,
                ims_company_location_guid,
                ims_quoting_location_guid, ims_issuing_location_guid,
                rater_template_path, rater_config, form_config,
                min_premium, max_premium, auto_bind_limit,
                requires_underwriter_approval, display_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `, [
            instanceId, line_name, line_code, description,
            ims_line_guid, ims_company_guid, ims_procedure_name,
            ims_company_location_guid,
            ims_quoting_location_guid, ims_issuing_location_guid,
            rater_template_path, JSON.stringify(rater_config || {}),
            JSON.stringify(form_config || {}),
            min_premium, max_premium, auto_bind_limit,
            requires_underwriter_approval, display_order || 0
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating line of business:', error);
        res.status(500).json({ error: 'Failed to create line of business' });
    }
});

// Update line of business
router.put('/lines-of-business/:lobId', requirePermission('producer_portal.lob.manage'), async (req, res) => {
    try {
        const { lobId } = req.params;
        const updates = req.body;

        // Build dynamic update query
        const allowedFields = [
            'line_name', 'line_code', 'description',
            'ims_line_guid', 'ims_company_location_guid',
            'ims_quoting_location_guid', 'ims_issuing_location_guid',
            'rater_template_path', 'rater_config',
            'min_premium', 'max_premium', 'auto_bind_limit',
            'requires_underwriter_approval', 'display_order', 'is_active'
        ];

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                setClause.push(`${field} = $${paramIndex}`);
                values.push(field === 'rater_config' ? JSON.stringify(updates[field]) : updates[field]);
                paramIndex++;
            }
        }

        if (setClause.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(lobId, req.user.instanceId);

        const result = await pool.query(`
            UPDATE portal_lines_of_business
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE lob_id = $${paramIndex} AND instance_id = $${paramIndex + 1}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Line of business not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating line of business:', error);
        res.status(500).json({ error: 'Failed to update line of business' });
    }
});

// Get producer statistics
router.get('/statistics', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        const targetInstanceId = instanceId || req.user.instanceId;
        
        if (!targetInstanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        const stats = await producerManagementService.getProducerStatistics(targetInstanceId);

        // Get submission statistics
        const submissionStats = await pool.query(`
            SELECT 
                COUNT(DISTINCT s.submission_id) as total_submissions,
                COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.submission_id END) as completed_submissions,
                COUNT(DISTINCT CASE WHEN s.ims_policy_number IS NOT NULL THEN s.submission_id END) as bound_policies,
                COUNT(DISTINCT ps.producer_id) as active_producers,
                COUNT(DISTINCT CASE WHEN s.submitted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN s.submission_id END) as submissions_last_30_days
            FROM producer_submissions ps
            JOIN custom_route_submissions s ON ps.submission_id = s.submission_id
            JOIN producers p ON ps.producer_id = p.producer_id
            WHERE p.instance_id = $1
        `, [targetInstanceId]);

        res.json({
            producers: stats,
            submissions: submissionStats.rows[0]
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get producer activity logs
router.get('/activity', requirePermission('producer_portal.producers.view'), async (req, res) => {
    try {
        const { days = 30, producerId } = req.query;

        let query = `
            SELECT 
                pal.*,
                p.first_name,
                p.last_name,
                p.agency_name,
                p.email
            FROM producer_audit_log pal
            JOIN producers p ON pal.producer_id = p.producer_id
            WHERE p.instance_id = $1
            AND pal.created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
        `;

        const params = [req.user.instanceId, days];

        if (producerId) {
            query += ' AND pal.producer_id = $3';
            params.push(producerId);
        }

        query += ' ORDER BY pal.created_at DESC LIMIT 100';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

// Quick endpoint to verify producer email (for development)
router.post('/verify-email-dev', requirePermission('producer_portal.manage'), async (req, res) => {
    try {
        const { email } = req.body;
        
        const result = await pool.query(
            'UPDATE producers SET email_verified = true WHERE email = $1 RETURNING producer_id, email, first_name, last_name',
            [email]
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true, producer: result.rows[0] });
        } else {
            res.status(404).json({ error: 'Producer not found' });
        }
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ error: 'Failed to verify email' });
    }
});

module.exports = router;