const router = require('express').Router();
const emailFilingService = require('../services/emailFilingService');
const pool = require('../config/db');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all email filing configurations for the authenticated user
router.get('/configs', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const instanceId = req.query.instance_id;
        
        const configs = await emailFilingService.getEmailFilingConfigs(userId, instanceId);
        
        res.json({
            success: true,
            configs: configs
        });

    } catch (error) {
        console.error('Error getting email filing configs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Create a new email filing configuration
router.post('/configs', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const configData = req.body;

        // Validate required fields
        if (!configData.name || !configData.instanceId) {
            return res.status(400).json({
                success: false,
                message: 'Name and instance ID are required'
            });
        }

        // Verify the instance belongs to the user
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [configData.instanceId, userId]
        );

        if (instanceCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'IMS instance not found or not authorized'
            });
        }

        const config = await emailFilingService.createEmailFilingConfig(
            userId,
            configData.instanceId,
            configData
        );

        res.json({
            success: true,
            message: 'Email filing configuration created',
            config: config
        });

    } catch (error) {
        console.error('Error creating email filing config:', error);
        
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({
                success: false,
                message: 'A configuration with this name already exists for this instance'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
});

// Get a specific email filing configuration
router.get('/configs/:configId', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { configId } = req.params;

        const config = await emailFilingService.getConfigById(configId);
        
        if (!config || config.user_id !== userId) {
            return res.status(404).json({
                success: false,
                message: 'Configuration not found or not authorized'
            });
        }

        res.json({
            success: true,
            config: config
        });

    } catch (error) {
        console.error('Error getting email filing config:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update an email filing configuration
router.put('/configs/:configId', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { configId } = req.params;
        const updates = req.body;

        // Verify ownership
        const config = await emailFilingService.getConfigById(configId);
        if (!config || config.user_id !== userId) {
            return res.status(404).json({
                success: false,
                message: 'Configuration not found or not authorized'
            });
        }

        // Build update query
        const allowedFields = [
            'name', 'default_folder_id', 'auto_extract_control_numbers',
            'control_number_patterns', 'file_email_as_pdf', 
            'include_attachments', 'is_active'
        ];

        const updateFields = [];
        const values = [configId];
        let paramIndex = 2;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        const query = `
            UPDATE email_filing_configs 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE config_id = $1 AND user_id = ${userId}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            message: 'Configuration updated',
            config: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating email filing config:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Delete an email filing configuration
router.delete('/configs/:configId', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { configId } = req.params;

        const result = await pool.query(
            'DELETE FROM email_filing_configs WHERE config_id = $1 AND user_id = $2 RETURNING *',
            [configId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuration not found or not authorized'
            });
        }

        res.json({
            success: true,
            message: 'Configuration deleted'
        });

    } catch (error) {
        console.error('Error deleting email filing config:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get email filing logs for the authenticated user
router.get('/logs', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const instanceId = req.query.instance_id;
        const limit = parseInt(req.query.limit) || 100;

        const logs = await emailFilingService.getEmailFilingLogs(userId, instanceId, limit);

        res.json({
            success: true,
            logs: logs
        });

    } catch (error) {
        console.error('Error getting email filing logs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get detailed log entry
router.get('/logs/:logId', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { logId } = req.params;

        const result = await pool.query(`
            SELECT efl.*, efc.name as config_name, ii.name as instance_name
            FROM email_filing_logs efl
            LEFT JOIN email_filing_configs efc ON efl.config_id = efc.config_id
            LEFT JOIN ims_instances ii ON efl.instance_id = ii.instance_id
            WHERE efl.log_id = $1 AND efl.user_id = $2
        `, [logId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Log entry not found or not authorized'
            });
        }

        res.json({
            success: true,
            log: result.rows[0]
        });

    } catch (error) {
        console.error('Error getting email filing log:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Manual email filing endpoint
router.post('/manual', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { configId, emailData } = req.body;

        if (!configId || !emailData) {
            return res.status(400).json({
                success: false,
                message: 'Configuration ID and email data are required'
            });
        }

        // Verify config ownership
        const config = await emailFilingService.getConfigById(configId);
        if (!config || config.user_id !== userId) {
            return res.status(404).json({
                success: false,
                message: 'Configuration not found or not authorized'
            });
        }

        const result = await emailFilingService.processIncomingEmail(configId, emailData);

        res.json({
            success: result.success,
            message: result.message,
            control_number: result.controlNumber,
            document_guid: result.documentGuid
        });

    } catch (error) {
        console.error('Error processing manual email filing:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get email filing statistics
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const instanceId = req.query.instance_id;

        let query = `
            SELECT 
                COUNT(*) as total_emails,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
                COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN processed_at >= CURRENT_DATE THEN 1 END) as today,
                COUNT(CASE WHEN processed_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as this_week
            FROM email_filing_logs 
            WHERE user_id = $1
        `;
        
        let params = [userId];

        if (instanceId) {
            query += ' AND instance_id = $2';
            params.push(instanceId);
        }

        const result = await pool.query(query, params);

        res.json({
            success: true,
            stats: result.rows[0]
        });

    } catch (error) {
        console.error('Error getting email filing stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Test control number extraction
router.post('/test-extraction', async (req, res) => {
    try {
        const { emailContent, patterns } = req.body;

        if (!emailContent) {
            return res.status(400).json({
                success: false,
                message: 'Email content is required'
            });
        }

        // Use provided patterns or defaults
        const testPatterns = patterns || [
            '\\b[A-Z]{2,4}[0-9]{6,10}\\b',
            '\\b[0-9]{8,12}\\b',
            '\\bPOL[A-Z0-9]{6,10}\\b',
            '\\bQUO[A-Z0-9]{6,10}\\b',
            '\\b[A-Z]{3}-[0-9]{6,9}\\b'
        ];

        const mockConfig = {
            control_number_patterns: testPatterns.join('\n')
        };

        const controlNumbers = await emailFilingService.extractControlNumbers(
            { 
                subject: emailContent.subject || '',
                body_text: emailContent.body || '',
                body_html: emailContent.html || ''
            },
            mockConfig
        );

        res.json({
            success: true,
            control_numbers: controlNumbers,
            patterns_used: testPatterns
        });

    } catch (error) {
        console.error('Error testing control number extraction:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;