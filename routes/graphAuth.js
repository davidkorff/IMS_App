const router = require('express').Router();
const graphService = require('../services/graphService');

// Step 1: Redirect to Microsoft for admin consent
router.get('/authorize', (req, res) => {
    try {
        console.log('=== STARTING GRAPH AUTHORIZATION ===');
        
        const authUrl = graphService.getAuthUrl();
        console.log('Redirecting to Microsoft for admin consent:', authUrl);
        
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error starting authorization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start authorization',
            error: error.message
        });
    }
});

// Step 2: Handle callback from Microsoft
router.get('/callback', async (req, res) => {
    try {
        console.log('=== GRAPH AUTHORIZATION CALLBACK ===');
        console.log('Query params:', req.query);
        
        const { code, error, error_description, admin_consent, tenant } = req.query;
        
        if (error) {
            console.error('Authorization error:', error, error_description);
            return res.status(400).json({
                success: false,
                message: 'Authorization failed',
                error: error,
                error_description: error_description
            });
        }

        // For admin consent flow, we get admin_consent=True and tenant parameters
        if (admin_consent === 'True' || tenant) {
            console.log('✅ Admin consent granted successfully');
            console.log('Tenant:', tenant);
            
            // Test the connection using client credentials flow
            const testResult = await graphService.testConnection();
            
            if (testResult.success) {
                res.json({
                    success: true,
                    message: 'Microsoft Graph admin consent successful!',
                    admin_consent: true,
                    tenant: tenant,
                    user_info: testResult.user,
                    next_steps: [
                        'Admin consent granted',
                        'Service can now access emails using application permissions',
                        'Test email reading at /auth/graph/test-emails'
                    ]
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Admin consent granted but connection test failed',
                    admin_consent: true,
                    tenant: tenant,
                    error: testResult.error,
                    error_details: testResult.details
                });
            }
        } else if (code) {
            console.log('Received authorization code, exchanging for token');
            
            const tokenData = await graphService.getAccessToken(code);
            console.log('Token exchange successful');
            
            // Test the connection
            const testResult = await graphService.testConnection();
            
            res.json({
                success: true,
                message: 'Microsoft Graph authorization successful!',
                token_obtained: true,
                user_info: testResult.success ? testResult.user : null,
                next_steps: [
                    'Authorization complete',
                    'Service can now access emails',
                    'Test email reading at /auth/graph/test-emails'
                ]
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'No authorization code or admin consent received'
            });
        }
    } catch (error) {
        console.error('Error in authorization callback:', error);
        res.status(500).json({
            success: false,
            message: 'Authorization callback failed',
            error: error.message
        });
    }
});

// Test endpoint - check connection and get recent emails
router.get('/test-connection', async (req, res) => {
    try {
        console.log('=== TESTING GRAPH CONNECTION ===');
        
        const testResult = await graphService.testConnection();
        
        res.json({
            success: testResult.success,
            message: testResult.success ? 'Connection successful' : 'Connection failed',
            user_info: testResult.user || null,
            error: testResult.error || null,
            details: testResult.details || null
        });
    } catch (error) {
        console.error('Error testing connection:', error);
        res.status(500).json({
            success: false,
            message: 'Connection test failed',
            error: error.message
        });
    }
});

// Test endpoint - get recent emails
router.get('/test-emails', async (req, res) => {
    try {
        console.log('=== TESTING EMAIL READING ===');
        
        const emails = await graphService.getRecentEmails(5);
        
        res.json({
            success: true,
            message: `Found ${emails.length} recent emails`,
            emails: emails
        });
    } catch (error) {
        console.error('Error getting test emails:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emails',
            error: error.message
        });
    }
});

// Test endpoint - get specific email with attachments
router.get('/test-email/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        console.log(`=== TESTING EMAIL DETAILS FOR ${messageId} ===`);
        
        const emailData = await graphService.getEmailWithAttachments(messageId);
        
        res.json({
            success: true,
            message: 'Email retrieved successfully',
            email: {
                ...emailData,
                // Don't return full attachment data in API response (too large)
                attachments: emailData.attachments.map(att => ({
                    name: att.name,
                    contentType: att.contentType,
                    size: att.size,
                    hasData: !!att.data
                }))
            }
        });
    } catch (error) {
        console.error('Error getting email details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get email details',
            error: error.message
        });
    }
});

// Debug endpoint - test different user approaches
router.get('/debug-users', async (req, res) => {
    try {
        console.log('=== DEBUGGING USER ACCESS ===');
        
        const client = await graphService.getGraphClient();
        const results = {};
        
        // Test 1: Try to list all users
        try {
            console.log('Testing: List all users');
            const users = await client.api('/users').top(10).get();
            results.allUsers = users.value.map(u => ({
                displayName: u.displayName,
                mail: u.mail,
                userPrincipalName: u.userPrincipalName
            }));
        } catch (error) {
            results.allUsersError = error.message;
        }
        
        // Test 2: Try documents@42consultingllc.com
        try {
            console.log('Testing: documents@42consultingllc.com');
            const user = await client.api('/users/documents@42consultingllc.com').get();
            results.documentsUser = {
                displayName: user.displayName,
                mail: user.mail,
                userPrincipalName: user.userPrincipalName
            };
        } catch (error) {
            results.documentsUserError = error.message;
        }
        
        // Test 3: Try david@42consultingllc.com (your admin account)
        try {
            console.log('Testing: david@42consultingllc.com');
            const user = await client.api('/users/david@42consultingllc.com').get();
            results.davidUser = {
                displayName: user.displayName,
                mail: user.mail,
                userPrincipalName: user.userPrincipalName
            };
        } catch (error) {
            results.davidUserError = error.message;
        }
        
        res.json({
            success: true,
            message: 'Debug results',
            results: results
        });
    } catch (error) {
        console.error('Error in debug:', error);
        res.status(500).json({
            success: false,
            message: 'Debug failed',
            error: error.message
        });
    }
});

// Status endpoint
router.get('/status', (req, res) => {
    const config = {
        clientId: !!process.env.GRAPH_CLIENT_ID,
        clientSecret: !!process.env.GRAPH_CLIENT_SECRET,
        tenantId: !!process.env.GRAPH_TENANT_ID,
        redirectUri: process.env.GRAPH_REDIRECT_URI || 'https://ims-application.onrender.com/auth/graph/callback',
        webhookUrl: process.env.GRAPH_WEBHOOK_URL || 'https://ims-application.onrender.com/webhooks/graph/email'
    };

    res.json({
        success: true,
        message: 'Graph Service Status',
        configuration: config,
        ready: config.clientId && config.clientSecret && config.tenantId,
        next_steps: config.clientId && config.clientSecret && config.tenantId 
            ? ['Configuration complete', 'Visit /auth/graph/authorize to start authorization']
            : ['Set GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, and GRAPH_TENANT_ID environment variables']
    });
});

module.exports = router;