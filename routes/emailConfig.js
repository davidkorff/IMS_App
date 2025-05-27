const router = require('express').Router();
const emailConfigService = require('../services/emailConfigService');
const emailProcessor = require('../services/emailProcessorV2');
const pool = require('../config/db');

// Get all email configurations for an instance
router.get('/config/:instanceId/all', async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                id,
                config_type,
                email_address,
                auto_extract_control_numbers,
                include_attachments,
                default_folder_id,
                test_status,
                last_tested_at,
                created_at,
                updated_at
            FROM email_configurations 
            WHERE instance_id = $1
            ORDER BY created_at ASC
        `, [instanceId]);
        
        res.json({
            success: true,
            configs: result.rows
        });
    } catch (error) {
        console.error('Error getting all email configs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get email configurations',
            error: error.message
        });
    }
});

// Get specific email configuration
router.get('/config/:instanceId/:configId', async (req, res) => {
    try {
        const { instanceId, configId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                ec.*,
                ii.name as instance_name,
                ii.email_status
            FROM email_configurations ec
            JOIN ims_instances ii ON ec.instance_id = ii.instance_id
            WHERE ec.instance_id = $1 AND ec.id = $2
        `, [instanceId, configId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuration not found'
            });
        }

        const config = result.rows[0];
        
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
        console.error('Error getting specific email config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get email configuration',
            error: error.message
        });
    }
});

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
        const { email_suffix, default_folder_id = 0 } = req.body;
        
        // For backward compatibility, check for email_prefix too
        const suffix = email_suffix || req.body.email_prefix;
        
        // Validate email suffix
        if (!suffix) {
            return res.status(400).json({
                success: false,
                message: 'Email suffix is required'
            });
        }
        
        const PlusAddressEmailService = require('../services/plusAddressEmailService');
        const plusAddressEmailService = new PlusAddressEmailService();
        
        // Validate suffix format (alphanumeric, hyphens, underscores)
        const suffixPattern = /^[a-zA-Z0-9\-_]+$/;
        if (!suffixPattern.test(suffix)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email suffix format. Use only letters, numbers, hyphens, and underscores.'
            });
        }
        
        // Check if this exact suffix is already in use
        const existingConfig = await pool.query(
            'SELECT id FROM email_configurations WHERE email_address = $1',
            [`documents+${suffix}@42consultingllc.com`]
        );
        
        if (existingConfig.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This email suffix is already in use. Please choose a different one.'
            });
        }
        
        // Get instance details including subdomain
        const instanceResult = await pool.query(
            'SELECT name, email_subdomain FROM ims_instances WHERE instance_id = $1',
            [instanceId]
        );
        
        if (instanceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Instance not found'
            });
        }

        const instance = instanceResult.rows[0];
        
        // Generate full plus email address using the custom suffix
        const fullEmailAddress = `documents+${suffix}@42consultingllc.com`;
        
        // Create email configuration with custom suffix
        const config = await emailConfigService.createSubdomainEmailConfig(
            instanceId, 
            suffix,  // Store the suffix as the prefix
            fullEmailAddress,
            default_folder_id
        );
        
        res.json({
            success: true,
            message: 'Email configuration created successfully',
            email_address: fullEmailAddress,
            config_id: config.id,
            email_suffix: suffix
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

        // Check if this exact configuration already exists
        const existingResult = await pool.query(`
            SELECT * FROM email_configurations 
            WHERE instance_id = $1 AND config_type = 'client_hosted' AND email_address = $2
        `, [instanceId, email_address]);
        
        if (existingResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'A client-hosted configuration for this email address already exists'
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

        // Test the specific configuration
        const testResult = await emailConfigService.testSpecificEmailConfig(instanceId, config.id);
        
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

// Test specific email configuration
router.post('/test-config/:instanceId/:configId', async (req, res) => {
    try {
        const { instanceId, configId } = req.params;
        
        const testResult = await emailConfigService.testSpecificEmailConfig(instanceId, configId);
        
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

// Test all configurations for an instance
router.post('/test-all-configs/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        const results = await emailConfigService.testAllEmailConfigs(instanceId);
        
        res.json({
            success: true,
            message: 'All configurations tested',
            results: results
        });
    } catch (error) {
        console.error('Error testing all email configs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test email configurations',
            error: error.message
        });
    }
});

// Test email configuration (legacy route - tests first config)
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

// Delete specific email configuration
router.delete('/config/:instanceId/:configId', async (req, res) => {
    try {
        const { instanceId, configId } = req.params;
        
        // Delete specific configuration
        const deleteResult = await pool.query(
            'DELETE FROM email_configurations WHERE instance_id = $1 AND id = $2',
            [instanceId, configId]
        );
        
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Email configuration not found'
            });
        }
        
        // Check if any configurations remain
        const remainingResult = await pool.query(
            'SELECT COUNT(*) as count FROM email_configurations WHERE instance_id = $1',
            [instanceId]
        );
        
        // Update instance status if no configurations remain
        if (parseInt(remainingResult.rows[0].count) === 0) {
            await pool.query(`
                UPDATE ims_instances 
                SET email_status = 'not_configured',
                    email_config = NULL
                WHERE instance_id = $1
            `, [instanceId]);
        }
        
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

// Delete email configuration (legacy route for all configs)
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

// Update specific email configuration
router.put('/config/:instanceId/:configId', async (req, res) => {
    try {
        const { instanceId, configId } = req.params;
        const {
            auto_extract_control_numbers,
            include_attachments,
            default_folder_id,
            control_number_patterns,
            email_address,
            email_prefix
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

        if (email_address) {
            // Validate email address format for plus addressing
            const plusAddressPattern = /^documents\+[a-zA-Z0-9\-_]+@42consultingllc\.com$/;
            if (!plusAddressPattern.test(email_address)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email address format. Must be documents+[suffix]@42consultingllc.com'
                });
            }
            
            // Check if email address is already in use by another config
            const existingConfig = await pool.query(
                'SELECT id FROM email_configurations WHERE email_address = $1 AND id != $2',
                [email_address, configId]
            );
            
            if (existingConfig.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'This email address is already in use by another configuration'
                });
            }
            
            updateFields.push(`email_address = $${paramIndex++}`);
            updateValues.push(email_address);
        }

        if (email_prefix) {
            updateFields.push(`email_prefix = $${paramIndex++}`);
            updateValues.push(email_prefix);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(configId);

        const query = `
            UPDATE email_configurations 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex} AND instance_id = $${paramIndex + 1}
            RETURNING *
        `;
        updateValues.push(instanceId);

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
        console.error('Error updating specific email config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update email configuration',
            error: error.message
        });
    }
});

// Update email configuration settings (legacy route)
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

// Manual email processing trigger (for testing)
router.post('/process-emails/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        console.log(`Manual email processing triggered for instance ${instanceId}`);
        
        const result = await emailProcessor.processInstanceNow(instanceId);
        
        res.json({
            success: result.success,
            message: result.success ? 
                'Email processing completed successfully' : 
                'Email processing failed',
            details: result.error || result.message
        });
    } catch (error) {
        console.error('Error in manual email processing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process emails',
            error: error.message
        });
    }
});

// Start/stop email processing service
router.post('/start-processing', async (req, res) => {
    try {
        const { intervalMinutes = 5 } = req.body;
        
        await emailProcessor.startProcessing(intervalMinutes);
        
        res.json({
            success: true,
            message: `Email processing started (every ${intervalMinutes} minutes)`
        });
    } catch (error) {
        console.error('Error starting email processing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start email processing',
            error: error.message
        });
    }
});

router.post('/stop-processing', async (req, res) => {
    try {
        emailProcessor.stopProcessing();
        
        res.json({
            success: true,
            message: 'Email processing stopped'
        });
    } catch (error) {
        console.error('Error stopping email processing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop email processing',
            error: error.message
        });
    }
});

module.exports = router;