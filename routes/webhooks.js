const router = require('express').Router();
const emailFilingService = require('../services/emailFilingService');
const pool = require('../config/db');
const crypto = require('crypto');

// Webhook endpoint for Zapier email integration
router.post('/zapier/:configId/email', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Zapier webhook received for config: ${req.params.configId}`);
    
    try {
        const { configId } = req.params;
        const emailData = req.body;

        // Log the incoming request (excluding sensitive data)
        console.log(`[${requestId}] Email data:`, {
            subject: emailData.subject,
            from: emailData.from,
            hasBody: !!emailData.body_text || !!emailData.body_html,
            attachmentCount: emailData.attachments ? emailData.attachments.length : 0
        });

        // Validate webhook secret (optional security measure)
        const config = await emailFilingService.getConfigById(configId);
        if (!config) {
            console.log(`[${requestId}] Config not found: ${configId}`);
            return res.status(404).json({ 
                success: false, 
                message: 'Configuration not found' 
            });
        }

        if (!config.is_active) {
            console.log(`[${requestId}] Config is inactive: ${configId}`);
            return res.status(400).json({ 
                success: false, 
                message: 'Configuration is inactive' 
            });
        }

        // Validate required email data
        if (!emailData.subject || !emailData.from) {
            console.log(`[${requestId}] Missing required email data`);
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required email data (subject, from)' 
            });
        }

        // Process the email
        const result = await emailFilingService.processIncomingEmail(configId, {
            subject: emailData.subject,
            from: emailData.from,
            to: emailData.to,
            date: emailData.date || new Date().toISOString(),
            message_id: emailData.message_id || `zapier-${Date.now()}`,
            body_text: emailData.body_text || emailData.body_plain,
            body_html: emailData.body_html,
            attachments: emailData.attachments || []
        });

        console.log(`[${requestId}] Processing result:`, result);

        // Return appropriate response to Zapier
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                control_number: result.controlNumber,
                document_guid: result.documentGuid,
                request_id: requestId
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message,
                request_id: requestId
            });
        }

    } catch (error) {
        console.error(`[${requestId}] Webhook error:`, error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            request_id: requestId
        });
    }
});

// Test endpoint for Zapier webhook connectivity
router.get('/zapier/:configId/test', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Webhook test request for config: ${req.params.configId}`);

    try {
        const { configId } = req.params;
        
        const config = await emailFilingService.getConfigById(configId);
        if (!config) {
            return res.status(404).json({ 
                success: false, 
                message: 'Configuration not found' 
            });
        }

        res.json({
            success: true,
            message: 'Webhook endpoint is accessible',
            config_id: configId,
            config_name: config.name,
            instance_name: config.instance_name,
            is_active: config.is_active,
            webhook_url: `/api/webhooks/zapier/${configId}/email`,
            timestamp: new Date().toISOString(),
            request_id: requestId
        });

    } catch (error) {
        console.error(`[${requestId}] Test webhook error:`, error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            request_id: requestId
        });
    }
});

// Endpoint to validate webhook secret (for manual testing)
router.post('/zapier/:configId/validate', async (req, res) => {
    try {
        const { configId } = req.params;
        const { webhook_secret } = req.body;

        const config = await emailFilingService.getConfigById(configId);
        if (!config) {
            return res.status(404).json({ 
                success: false, 
                message: 'Configuration not found' 
            });
        }

        const isValid = config.webhook_secret === webhook_secret;
        
        res.json({
            success: true,
            valid: isValid,
            message: isValid ? 'Webhook secret is valid' : 'Invalid webhook secret'
        });

    } catch (error) {
        console.error('Webhook validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Manual email processing endpoint for testing
router.post('/manual-process', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Manual email processing request`);

    try {
        const { configId, emailData } = req.body;

        if (!configId || !emailData) {
            return res.status(400).json({
                success: false,
                message: 'Missing configId or emailData'
            });
        }

        const result = await emailFilingService.processIncomingEmail(configId, emailData);
        
        console.log(`[${requestId}] Manual processing result:`, result);

        res.json({
            success: result.success,
            message: result.message,
            control_number: result.controlNumber,
            document_guid: result.documentGuid,
            request_id: requestId
        });

    } catch (error) {
        console.error(`[${requestId}] Manual processing error:`, error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            request_id: requestId
        });
    }
});

// Health check endpoint for monitoring
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Webhook service is healthy',
        timestamp: new Date().toISOString(),
        service: 'email-filing-webhooks'
    });
});

// Get webhook statistics (for admin/debugging)
router.get('/stats/:configId', async (req, res) => {
    try {
        const { configId } = req.params;
        
        const config = await emailFilingService.getConfigById(configId);
        if (!config) {
            return res.status(404).json({ 
                success: false, 
                message: 'Configuration not found' 
            });
        }

        // Get basic stats from the logs
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_emails,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
                COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                MAX(processed_at) as last_processed
            FROM email_filing_logs 
            WHERE config_id = $1
        `, [configId]);

        res.json({
            success: true,
            config_id: configId,
            config_name: config.name,
            stats: stats.rows[0]
        });

    } catch (error) {
        console.error('Webhook stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;