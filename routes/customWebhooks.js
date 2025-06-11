const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const crypto = require('crypto');
const { VM } = require('vm2');
const fetch = require('node-fetch');
const { createIMSHelper, availableFunctions } = require('../services/imsHelperFunctions');

// Middleware to authenticate webhook requests
async function authenticateWebhook(req, res, next) {
    const { instanceId, endpointPath } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM custom_webhooks WHERE instance_id = $1 AND endpoint_path = $2 AND is_active = true',
            [instanceId, endpointPath]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Webhook not found or inactive' });
        }

        const webhook = result.rows[0];
        
        // Check IP whitelist if configured
        if (webhook.allowed_ips && webhook.allowed_ips.length > 0) {
            const clientIp = req.ip || req.connection.remoteAddress;
            if (!webhook.allowed_ips.includes(clientIp)) {
                console.warn(`Webhook ${webhook.id} access denied from IP: ${clientIp}`);
                return res.status(403).json({ error: 'Access denied from this IP address' });
            }
        }
        
        // Check authentication if required
        if (webhook.requires_auth) {
            const authType = webhook.auth_type || 'bearer';
            
            switch (authType) {
                case 'bearer':
                    const authHeader = req.headers.authorization;
                    if (!authHeader || !authHeader.startsWith('Bearer ')) {
                        return res.status(401).json({ error: 'Bearer token required' });
                    }
                    const token = authHeader.substring(7);
                    if (token !== webhook.auth_token) {
                        return res.status(401).json({ error: 'Invalid authentication token' });
                    }
                    break;
                    
                case 'hmac':
                    const signature = req.headers['x-webhook-signature'];
                    if (!signature) {
                        return res.status(401).json({ error: 'HMAC signature required' });
                    }
                    
                    // Calculate expected signature
                    const payload = JSON.stringify(req.body);
                    const expectedSignature = crypto
                        .createHmac('sha256', webhook.secret_key)
                        .update(payload)
                        .digest('hex');
                    
                    if (signature !== `sha256=${expectedSignature}`) {
                        return res.status(401).json({ error: 'Invalid HMAC signature' });
                    }
                    break;
                    
                case 'basic':
                    const basicAuth = req.headers.authorization;
                    if (!basicAuth || !basicAuth.startsWith('Basic ')) {
                        return res.status(401).json({ error: 'Basic authentication required' });
                    }
                    
                    const credentials = Buffer.from(basicAuth.substring(6), 'base64').toString();
                    const [username, password] = credentials.split(':');
                    
                    // For basic auth, we'll use endpoint_path as username and auth_token as password
                    if (username !== endpointPath || password !== webhook.auth_token) {
                        return res.status(401).json({ error: 'Invalid credentials' });
                    }
                    break;
                    
                default:
                    return res.status(500).json({ error: 'Unknown authentication type' });
            }
        }

        req.webhook = webhook;
        next();
    } catch (err) {
        console.error('Error authenticating webhook:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get all webhooks for an instance
router.get('/instance/:instanceId', authenticateToken, async (req, res) => {
    const { instanceId } = req.params;

    try {
        const result = await pool.query(
            'SELECT * FROM custom_webhooks WHERE instance_id = $1 ORDER BY created_at DESC',
            [instanceId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching webhooks:', err);
        res.status(500).json({ error: 'Failed to fetch webhooks' });
    }
});

// Get webhook templates
router.get('/templates', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM webhook_templates WHERE is_public = true ORDER BY category, name'
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching templates:', err);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Get available IMS functions
router.get('/ims-functions', authenticateToken, (req, res) => {
    res.json(availableFunctions);
});

// Create a new webhook
router.post('/', authenticateToken, async (req, res) => {
    const { 
        name, 
        endpoint_path, 
        description, 
        is_active, 
        requires_auth, 
        auth_type,
        auth_token, 
        secret_key,
        allowed_ips,
        python_code, 
        instance_id 
    } = req.body;

    try {
        // Validate endpoint path
        if (!/^[a-z0-9-]+$/.test(endpoint_path)) {
            return res.status(400).json({ 
                error: 'Invalid endpoint path. Only lowercase letters, numbers, and hyphens allowed.' 
            });
        }

        // Generate auth token if needed and not provided
        const finalAuthToken = requires_auth && !auth_token 
            ? 'whk_' + crypto.randomBytes(32).toString('hex')
            : auth_token;

        const result = await pool.query(
            `INSERT INTO custom_webhooks 
            (instance_id, name, endpoint_path, description, is_active, requires_auth, auth_type, auth_token, secret_key, allowed_ips, python_code, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [instance_id, name, endpoint_path, description, is_active, requires_auth, auth_type || 'bearer', finalAuthToken, secret_key, allowed_ips, python_code, req.user.user_id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating webhook:', err);
        if (err.code === '23505') { // Unique constraint violation
            res.status(400).json({ error: 'A webhook with this endpoint path already exists for this instance' });
        } else {
            res.status(500).json({ error: 'Failed to create webhook' });
        }
    }
});

// Update a webhook
router.put('/:webhookId', authenticateToken, async (req, res) => {
    const { webhookId } = req.params;
    const { 
        name, 
        endpoint_path, 
        description, 
        is_active, 
        requires_auth, 
        auth_type,
        auth_token, 
        secret_key,
        allowed_ips,
        python_code 
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE custom_webhooks 
            SET name = $2, endpoint_path = $3, description = $4, is_active = $5, 
                requires_auth = $6, auth_type = $7, auth_token = $8, secret_key = $9, 
                allowed_ips = $10, python_code = $11, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *`,
            [webhookId, name, endpoint_path, description, is_active, requires_auth, auth_type || 'bearer', auth_token, secret_key, allowed_ips, python_code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating webhook:', err);
        res.status(500).json({ error: 'Failed to update webhook' });
    }
});

// Delete a webhook
router.delete('/:webhookId', authenticateToken, async (req, res) => {
    const { webhookId } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM custom_webhooks WHERE id = $1 RETURNING id',
            [webhookId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        res.json({ message: 'Webhook deleted successfully' });
    } catch (err) {
        console.error('Error deleting webhook:', err);
        res.status(500).json({ error: 'Failed to delete webhook' });
    }
});

// Test webhook code
router.post('/test', authenticateToken, async (req, res) => {
    const { python_code, test_data, test_context } = req.body;

    try {
        const result = await executePythonCode(python_code, test_data, {
            headers: req.headers,
            instance_id: 'test',
            user: req.user,
            ...test_context
        });

        res.json(result);
    } catch (err) {
        console.error('Error testing webhook:', err);
        res.status(400).json({ 
            error: err.message,
            type: 'execution_error'
        });
    }
});

// Get webhook logs
router.get('/logs/instance/:instanceId', authenticateToken, async (req, res) => {
    const { instanceId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
        const result = await pool.query(
            `SELECT we.*, cw.name as webhook_name 
            FROM webhook_executions we
            JOIN custom_webhooks cw ON we.webhook_id = cw.id
            WHERE cw.instance_id = $1
            ORDER BY we.executed_at DESC
            LIMIT $2 OFFSET $3`,
            [instanceId, limit, offset]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Get specific webhook execution details
router.get('/logs/execution/:executionId', authenticateToken, async (req, res) => {
    const { executionId } = req.params;

    try {
        const result = await pool.query(
            `SELECT we.*, cw.name as webhook_name, cw.endpoint_path
            FROM webhook_executions we
            JOIN custom_webhooks cw ON we.webhook_id = cw.id
            WHERE we.id = $1`,
            [executionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Execution not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching execution details:', err);
        res.status(500).json({ error: 'Failed to fetch execution details' });
    }
});

// Handle incoming webhook requests
router.post('/:instanceId/:endpointPath', authenticateWebhook, async (req, res) => {
    const webhook = req.webhook;
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
        // Execute the Python code
        const result = await executePythonCode(webhook.python_code, req.body, {
            headers: req.headers,
            instance_id: webhook.instance_id,
            webhook_id: webhook.id,
            request_id: requestId,
            ip_address: req.ip
        });

        const executionTime = Date.now() - startTime;

        // Log the execution
        await pool.query(
            `INSERT INTO webhook_executions 
            (webhook_id, request_id, request_headers, request_body, response_status, response_body, execution_time_ms, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                webhook.id,
                requestId,
                JSON.stringify(req.headers),
                JSON.stringify(req.body),
                200,
                JSON.stringify(result),
                executionTime,
                req.ip
            ]
        );

        res.json(result);
    } catch (err) {
        const executionTime = Date.now() - startTime;
        
        // Log the error
        await pool.query(
            `INSERT INTO webhook_executions 
            (webhook_id, request_id, request_headers, request_body, response_status, error_message, execution_time_ms, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                webhook.id,
                requestId,
                JSON.stringify(req.headers),
                JSON.stringify(req.body),
                500,
                err.message,
                executionTime,
                req.ip
            ]
        );

        console.error('Webhook execution error:', err);
        res.status(500).json({ 
            error: 'Webhook execution failed',
            message: err.message,
            request_id: requestId
        });
    }
});

// Execute Python code in a sandbox
async function executePythonCode(code, data, context) {
    // For now, we'll use a JavaScript implementation
    // In production, you'd want to use a proper Python sandbox
    
    // Get instance configuration for IMS helper
    let imsHelper = null;
    if (context.instance_id && context.instance_id !== 'test') {
        try {
            const instanceResult = await pool.query(
                'SELECT * FROM ims_instances WHERE instance_id = $1',
                [context.instance_id]
            );
            
            if (instanceResult.rows.length > 0) {
                const instance = instanceResult.rows[0];
                imsHelper = createIMSHelper({
                    url: instance.url,
                    username: instance.username,
                    password: instance.password
                });
            }
        } catch (err) {
            console.warn('Could not load instance config for IMS helper:', err.message);
        }
    }
    
    // Create a sandbox with limited capabilities
    const sandbox = {
        data: data,
        context: context,
        console: console,
        fetch: fetch,
        JSON: JSON,
        Date: Date,
        Math: Math,
        // Add IMS helper functions
        ims_functions: imsHelper || {
            // Mock functions for testing when no IMS instance is available
            login: async () => ({ token: 'mock-token-' + Date.now(), userGuid: 'mock-user-guid' }),
            executeStoredProcedure: async (procedureName, parameters) => ({ 
                Table: [{ result: 'mock-result', procedureName, parameters }] 
            }),
            executeWebMethod: async (webservice, method, parameters) => ({ 
                result: 'mock-result',
                webservice,
                method,
                parameters
            }),
            addInsuredWithLocation: async (data) => ({ 
                insuredGuid: 'mock-insured-guid-' + Date.now(), 
                locationGuid: 'mock-location-guid-' + Date.now() 
            }),
            findInsuredByName: async (searchTerm) => ([
                { insuredGuid: 'mock-guid-1', name: searchTerm + ' Company 1' },
                { insuredGuid: 'mock-guid-2', name: searchTerm + ' Company 2' }
            ]),
            createSubmission: async (data) => ({ submissionGuid: 'mock-submission-guid-' + Date.now() }),
            addQuote: async (data) => 'mock-quote-guid-' + Date.now(),
            bindQuote: async (quoteGuid, options) => 'MOCK-POL-' + Date.now(),
            searchProducers: async (searchTerm) => ([
                { producerGuid: 'mock-producer-1', name: searchTerm + ' Agency' }
            ]),
            createPolicyDocument: async (policyNumber, docTypeId) => ({ 
                success: true, 
                documentData: 'bW9jay1kb2N1bWVudC1kYXRh' 
            }),
            getStates: async () => ({ Table: [
                { StateCode: 'NY', StateName: 'New York' },
                { StateCode: 'CA', StateName: 'California' }
            ]}),
            getCompanies: async () => ({ Table: [
                { CompanyID: 1, CompanyName: 'Mock Insurance Co' }
            ]}),
            getLines: async () => ({ Table: [
                { LineCode: 'GL', LineName: 'General Liability' },
                { LineCode: 'WC', LineName: 'Workers Compensation' }
            ]})
        }
    };

    // Convert Python-like code to JavaScript (improved conversion)
    let jsCode = code;
    
    // First, handle docstrings
    jsCode = jsCode.replace(/"""[\s\S]*?"""/g, (match) => {
        return '/*' + match.slice(3, -3) + '*/';
    });
    
    // Handle single quotes in Python strings
    jsCode = jsCode.replace(/'/g, '"');
    
    // Convert function definition
    jsCode = jsCode.replace(/def handle_webhook\(data, context\):/g, 'function handle_webhook(data, context) {');
    
    // Convert Python keywords
    jsCode = jsCode.replace(/\bTrue\b/g, 'true');
    jsCode = jsCode.replace(/\bFalse\b/g, 'false');
    jsCode = jsCode.replace(/\bNone\b/g, 'null');
    
    // Convert print statements
    jsCode = jsCode.replace(/print\(/g, 'console.log(');
    
    // Handle f-strings (basic conversion)
    jsCode = jsCode.replace(/f"([^"]*\{[^}]*\}[^"]*)"/g, (match) => {
        // Convert f"text {variable}" to template literal
        let content = match.slice(2, -1); // Remove f" and "
        content = content.replace(/\{([^}]+)\}/g, '${$1}');
        return '`' + content + '`';
    });
    
    // Also handle f-strings that were converted from single quotes
    jsCode = jsCode.replace(/f`([^`]*\$\{[^}]*\}[^`]*)`/g, '`$1`');
    
    // Convert imports
    jsCode = jsCode.replace(/from ims_functions import .*/g, '// IMS functions available via ims_functions object');
    
    // Convert Python comments to JavaScript comments
    jsCode = jsCode.replace(/^\s*#(.*)$/gm, '    //$1');
    
    // Convert Python indentation to JavaScript blocks
    const lines = jsCode.split('\n');
    let result = [];
    let indentLevel = 0;
    let braceAdded = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let trimmed = line.trim();
        
        if (trimmed === '') {
            result.push(line);
            continue;
        }
        
        // Count leading spaces
        let currentIndent = line.length - line.trimLeft().length;
        
        // If this is the function definition, we already handled it
        if (trimmed.startsWith('function handle_webhook')) {
            result.push(line);
            braceAdded = true;
            continue;
        }
        
        // Add opening brace after function definition if not already added
        if (braceAdded && currentIndent > 0 && indentLevel === 0) {
            indentLevel = currentIndent;
        }
        
        // Convert Python return to JavaScript return
        if (trimmed.startsWith('return ')) {
            line = line.replace('return ', 'return ');
        }
        
        result.push(line);
    }
    
    // Add closing brace for function
    if (braceAdded) {
        result.push('}');
    }
    
    jsCode = result.join('\n');

    // Wrap the code to ensure it returns a value
    jsCode = `
        (function() {
            ${jsCode}
            
            // Call the handler function
            return handle_webhook(data, context);
        })();
    `;

    try {
        // Log the converted JavaScript code for debugging
        console.log('Converted JavaScript code:');
        console.log('='.repeat(50));
        console.log(jsCode);
        console.log('='.repeat(50));
        
        // Create a limited VM for security
        const vm = new VM({
            timeout: 5000, // 5 second timeout
            sandbox: sandbox
        });

        const result = vm.run(jsCode);
        return result || { status: 'success', message: 'Webhook processed' };
    } catch (err) {
        console.error('JavaScript execution error:');
        console.error('Code that failed:', jsCode);
        console.error('Error:', err.message);
        throw new Error(`Code execution error: ${err.message}`);
    }
}

module.exports = router;