const router = require('express').Router();
const emailConfigService = require('../services/emailConfigService');
const pool = require('../config/db');

// Get email configuration for an instance
router.get('/config/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        const config = await emailConfigService.getEmailConfig(instanceId);
        
        if (!config) {
            return res.json({
                success: true,
                config: null,
                message: 'No email configuration found'
            });
        }

        // Remove sensitive data from response
        const safeConfig = { ...config };
        delete safeConfig.graph_client_secret;
        delete safeConfig.graph_client_id_encrypted;
        delete safeConfig.graph_client_secret_encrypted;
        delete safeConfig.graph_tenant_id_encrypted;

        res.json({
            success: true,
            config: safeConfig
        });
    } catch (error) {
        console.error('Error getting email config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get email configuration',
            error: error.message
        });
    }
});

// Setup managed email configuration
router.post('/setup-managed/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        // Get instance details
        const instanceResult = await pool.query(
            'SELECT name FROM ims_instances WHERE instance_id = $1',
            [instanceId]
        );
        
        if (instanceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Instance not found'
            });
        }

        const instanceName = instanceResult.rows[0].name;
        
        // Create managed email configuration
        const config = await emailConfigService.createManagedEmailConfig(instanceId, instanceName);
        
        res.json({
            success: true,
            message: 'Managed email configuration created successfully',
            email_address: config.email_address,
            config_id: config.id
        });
    } catch (error) {
        console.error('Error setting up managed email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup managed email',
            error: error.message
        });
    }
});

// Setup client-hosted email configuration
router.post('/setup-client-hosted/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const {
            client_id,
            client_secret,
            tenant_id,
            email_address,
            auto_extract_control_numbers = true,
            include_attachments = true,
            default_folder_id = 3
        } = req.body;

        // Validate required fields
        if (!client_id || !client_secret || !tenant_id || !email_address) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: client_id, client_secret, tenant_id, email_address'
            });
        }

        // Create client-hosted email configuration
        const config = await emailConfigService.createClientHostedEmailConfig(instanceId, {
            email_address,
            graph_client_id: client_id,
            graph_client_secret: client_secret,
            graph_tenant_id: tenant_id,
            auto_extract_control_numbers,
            include_attachments,
            default_folder_id
        });

        // Test the configuration
        const testResult = await emailConfigService.testEmailConfig(instanceId);
        
        res.json({
            success: testResult.success,
            message: testResult.success ? 
                'Client-hosted email configuration created and tested successfully' :
                'Configuration created but test failed',
            config_id: config.id,
            test_result: testResult
        });
    } catch (error) {
        console.error('Error setting up client-hosted email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup client-hosted email',
            error: error.message
        });
    }
});

// Test email configuration
router.post('/test-config/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        const testResult = await emailConfigService.testEmailConfig(instanceId);
        
        res.json({
            success: testResult.success,
            message: testResult.success ? 
                'Email configuration test passed' : 
                'Email configuration test failed',
            test_result: testResult
        });
    } catch (error) {
        console.error('Error testing email config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test email configuration',
            error: error.message
        });
    }
});

// Delete email configuration
router.delete('/config/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        // Delete from email_configurations table
        await pool.query('DELETE FROM email_configurations WHERE instance_id = $1', [instanceId]);
        
        // Update instance status
        await pool.query(`
            UPDATE ims_instances 
            SET email_status = 'not_configured',
                email_config = NULL
            WHERE instance_id = $1
        `, [instanceId]);
        
        res.json({
            success: true,
            message: 'Email configuration deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting email config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete email configuration',
            error: error.message
        });
    }
});

// Get email processing stats
router.get('/stats/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { days = 30 } = req.query;
        
        const stats = await emailConfigService.getEmailStats(instanceId, parseInt(days));
        
        res.json({
            success: true,
            stats: stats,
            period_days: parseInt(days)
        });
    } catch (error) {
        console.error('Error getting email stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get email statistics',
            error: error.message
        });
    }
});

// Get recent email processing logs
router.get('/logs/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { limit = 50 } = req.query;
        
        const result = await pool.query(`
            SELECT 
                id,
                email_address,
                subject,
                control_number,
                processing_status,
                error_message,
                attachments_count,
                processed_at,
                filed_to_ims,
                ims_document_guid
            FROM email_processing_logs 
            WHERE instance_id = $1 
            ORDER BY processed_at DESC 
            LIMIT $2
        `, [instanceId, parseInt(limit)]);
        
        res.json({
            success: true,
            logs: result.rows
        });
    } catch (error) {
        console.error('Error getting email logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get email processing logs',
            error: error.message
        });
    }
});

// Update email configuration settings
router.put('/config/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const {
            auto_extract_control_numbers,
            include_attachments,
            default_folder_id,
            control_number_patterns
        } = req.body;

        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (typeof auto_extract_control_numbers === 'boolean') {
            updateFields.push(`auto_extract_control_numbers = $${paramIndex++}`);
            updateValues.push(auto_extract_control_numbers);
        }

        if (typeof include_attachments === 'boolean') {
            updateFields.push(`include_attachments = $${paramIndex++}`);
            updateValues.push(include_attachments);
        }

        if (default_folder_id) {
            updateFields.push(`default_folder_id = $${paramIndex++}`);
            updateValues.push(default_folder_id);
        }

        if (control_number_patterns && Array.isArray(control_number_patterns)) {
            updateFields.push(`control_number_patterns = $${paramIndex++}`);
            updateValues.push(control_number_patterns);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(instanceId);

        const query = `
            UPDATE email_configurations 
            SET ${updateFields.join(', ')}
            WHERE instance_id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, updateValues);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Email configuration not found'
            });
        }

        res.json({
            success: true,
            message: 'Email configuration updated successfully',
            config: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating email config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update email configuration',
            error: error.message
        });
    }
});

module.exports = router;