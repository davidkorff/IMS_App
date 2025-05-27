const router = require('express').Router();
const emailFilingService = require('../services/emailFilingService');
const pool = require('../config/db');
const crypto = require('crypto');

// Helper function to parse Microsoft Graph attachment format
function parseMicrosoftGraphAttachments(attachmentString) {
    const attachments = [];
    
    try {
        // Split by attachment entries (each starts with "atta")
        const entries = attachmentString.split(/(?=atta\w+)/);
        
        for (const entry of entries) {
            if (!entry.trim()) continue;
            
            const attachment = {};
            const lines = entry.split('\n');
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.includes(':')) {
                    const [key, ...valueParts] = trimmedLine.split(':');
                    const value = valueParts.join(':').trim();
                    
                    switch (key.toLowerCase()) {
                        case 'filename':
                        case 'name':
                            attachment.name = value;
                            break;
                        case 'contenttype':
                            attachment.content_type = value;
                            break;
                        case 'size':
                            // Remove file extension from size if present
                            attachment.size = parseInt(value.replace(/\D+/g, '')) || 0;
                            break;
                    }
                }
            }
            
            // Only add if we have at least a name
            if (attachment.name) {
                // Note: Microsoft Graph format doesn't include actual file data
                // This would need to be fetched separately via Graph API
                attachment.data = null; // No file data available
                attachment.error = 'File content not available - Microsoft Graph metadata only';
                attachments.push(attachment);
            }
        }
        
        console.log('Parsed Microsoft Graph attachments:', attachments);
        return attachments;
        
    } catch (error) {
        console.error('Error parsing Microsoft Graph attachments:', error);
        return [];
    }
}

// Microsoft Graph API attachment fetcher
async function fetchAttachmentFromGraph(attachmentId, messageId, accessToken) {
    try {
        const graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}`;
        
        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
        }
        
        const attachmentData = await response.json();
        
        if (attachmentData.contentBytes) {
            return {
                name: attachmentData.name,
                data: attachmentData.contentBytes, // Already base64 encoded
                content_type: attachmentData.contentType,
                size: attachmentData.size
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('Error fetching attachment from Graph API:', error);
        return null;
    }
}

// Hydrate content decoder for Microsoft Outlook attachments
function decodeHydrateContent(hydrateString) {
    try {
        console.log('Decoding hydrate content...');
        
        // Check if it's in hydrate format: hydrate|||[data]|||hydrate
        if (!hydrateString || typeof hydrateString !== 'string') {
            console.log('Invalid hydrate string format');
            return null;
        }
        
        // Extract the middle part between hydrate||| markers
        const hydratePattern = /^hydrate\|\|\|(.*?)\|\|\|hydrate$/;
        const match = hydrateString.match(hydratePattern);
        
        if (!match || !match[1]) {
            console.log('No hydrate pattern match found');
            return null;
        }
        
        const encodedData = match[1];
        console.log('Extracted encoded data length:', encodedData.length);
        
        // Django session format: .{base64_data}:{timestamp}:{signature}
        if (encodedData.startsWith('.')) {
            const parts = encodedData.split(':');
            if (parts.length >= 3) {
                const dataWithoutDot = parts[0].substring(1);
                
                try {
                    // Decode the URL-safe base64 data
                    const urlSafeData = dataWithoutDot.replace(/-/g, '+').replace(/_/g, '/');
                    const paddedData = urlSafeData + '='.repeat((4 - urlSafeData.length % 4) % 4);
                    const decoded = Buffer.from(paddedData, 'base64');
                    
                    // Check if it's zlib compressed (starts with 0x789c)
                    if (decoded[0] === 0x78 && decoded[1] === 0x9c) {
                        const zlib = require('zlib');
                        
                        try {
                            const decompressed = zlib.inflateSync(decoded);
                            const sessionData = JSON.parse(decompressed.toString('utf8'));
                            console.log('Successfully decoded hydrate session data with inflateSync');
                            return sessionData;
                        } catch (inflateError) {
                            console.log('Standard inflate failed, trying raw inflate without header:', inflateError.message);
                            
                            try {
                                // Skip the zlib header and try raw inflate
                                const withoutHeader = decoded.slice(2);
                                const decompressed = zlib.inflateRawSync(withoutHeader);
                                const sessionData = JSON.parse(decompressed.toString('utf8'));
                                console.log('Successfully decoded hydrate session data with raw inflate');
                                return sessionData;
                            } catch (rawError) {
                                console.log('Raw inflate also failed:', rawError.message);
                            }
                        }
                    }
                } catch (error) {
                    console.log('Failed to decode hydrate session:', error.message);
                }
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Error decoding hydrate content:', error);
        return null;
    }
}

// Fetch actual attachment from Microsoft Graph using hydrate data
async function fetchAttachmentFromHydrate(hydrateData, zapierAccessToken) {
    try {
        console.log('Fetching attachment from hydrate data...');
        
        if (!hydrateData || !hydrateData.kwargs || !hydrateData.kwargs.bundle) {
            console.log('Invalid hydrate data structure');
            return null;
        }
        
        const { emailId, inbox } = hydrateData.kwargs.bundle;
        console.log('Email ID:', emailId);
        console.log('Inbox:', inbox);
        
        // We need to use Zapier's access token to make the Graph API call
        // since the hydrate data contains references to Zapier's authentication
        const graphUrl = `https://graph.microsoft.com/v1.0/${inbox}/messages/${emailId}/attachments`;
        
        console.log('Making Graph API request to:', graphUrl);
        
        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${zapierAccessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.log(`Graph API error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.log('Error response:', errorText);
            return null;
        }
        
        const attachmentsData = await response.json();
        console.log('Graph API response:', JSON.stringify(attachmentsData, null, 2));
        
        if (attachmentsData.value && attachmentsData.value.length > 0) {
            const attachments = [];
            
            for (const attachment of attachmentsData.value) {
                if (attachment.contentBytes) {
                    attachments.push({
                        name: attachment.name,
                        data: attachment.contentBytes, // Already base64 encoded
                        content_type: attachment.contentType,
                        size: attachment.size,
                        source: 'graph_api_from_hydrate'
                    });
                    console.log(`Successfully fetched attachment: ${attachment.name} (${attachment.size} bytes)`);
                }
            }
            
            return attachments;
        }
        
        console.log('No attachments found in Graph API response');
        return [];
        
    } catch (error) {
        console.error('Error fetching attachment from hydrate:', error);
        return null;
    }
}

// Parse Outlook hydrate attachments
async function parseOutlookHydrateAttachments(emailData, zapierAccessToken = null) {
    const attachments = [];
    
    try {
        // Look for fields that might contain hydrate data
        const hydrateFields = Object.keys(emailData).filter(key => {
            const value = emailData[key];
            return typeof value === 'string' && value.includes('hydrate|||');
        });
        
        console.log('Found potential hydrate fields:', hydrateFields);
        
        for (const fieldName of hydrateFields) {
            const hydrateString = emailData[fieldName];
            console.log(`Processing hydrate field: ${fieldName}`);
            
            const hydrateData = decodeHydrateContent(hydrateString);
            
            if (hydrateData) {
                console.log('Decoded hydrate data:', JSON.stringify(hydrateData, null, 2));
                
                // If we have Zapier access token, try to fetch the actual attachment
                if (zapierAccessToken) {
                    const fetchedAttachments = await fetchAttachmentFromHydrate(hydrateData, zapierAccessToken);
                    if (fetchedAttachments && fetchedAttachments.length > 0) {
                        attachments.push(...fetchedAttachments);
                        continue;
                    }
                }
                
                // Fallback: create placeholder attachment with hydrate metadata
                let fileName = 'attachment';
                let contentType = 'application/octet-stream';
                
                // Look for corresponding name/type fields
                const baseName = fieldName.replace(/\s*(file|data|content)s?\s*/i, '').trim();
                
                const nameField = Object.keys(emailData).find(key => 
                    key.toLowerCase().includes(baseName.toLowerCase()) && 
                    key.toLowerCase().includes('name')
                );
                if (nameField && emailData[nameField]) {
                    fileName = emailData[nameField];
                }
                
                const typeField = Object.keys(emailData).find(key => 
                    key.toLowerCase().includes(baseName.toLowerCase()) && 
                    (key.toLowerCase().includes('type') || key.toLowerCase().includes('content'))
                );
                if (typeField && emailData[typeField]) {
                    contentType = emailData[typeField];
                }
                
                // Store hydrate metadata for potential later processing
                attachments.push({
                    name: fileName,
                    data: null, // No actual file data yet
                    content_type: contentType,
                    size: 0,
                    source: 'hydrate_metadata',
                    hydrate_data: hydrateData,
                    error: zapierAccessToken ? 'Failed to fetch from Graph API' : 'No Zapier access token provided'
                });
                
                console.log(`Stored hydrate metadata for: ${fileName}`);
            }
        }
        
        return attachments;
        
    } catch (error) {
        console.error('Error parsing Outlook hydrate attachments:', error);
        return [];
    }
}

// Webhook endpoint for Zapier email integration
router.post('/zapier/:configId/email', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`\n=== [${requestId}] ZAPIER WEBHOOK RECEIVED ===`);
    console.log(`Config ID: ${req.params.configId}`);
    console.log(`Method: ${req.method}`);
    console.log(`URL: ${req.originalUrl}`);
    console.log(`Content-Type: ${req.headers['content-type']}`);
    console.log(`User-Agent: ${req.headers['user-agent']}`);
    
    console.log(`\n=== [${requestId}] FULL REQUEST HEADERS ===`);
    console.log(req.headers);
    
    console.log(`\n=== [${requestId}] RAW REQUEST BODY ===`);
    console.log(req.body);
    
    console.log(`\n=== [${requestId}] BODY TYPE AND STRUCTURE ANALYSIS ===`);
    console.log(`Body type: ${typeof req.body}`);
    console.log(`Body keys: ${req.body ? Object.keys(req.body) : 'no keys'}`);
    console.log(`Body length: ${req.body ? Object.keys(req.body).length : 0}`);
    
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            const value = req.body[key];
            console.log(`- ${key}: ${typeof value} (${Array.isArray(value) ? 'array' : typeof value})`);
            if (typeof value === 'string' && value.length > 100) {
                console.log(`  Preview: ${value.substring(0, 100)}...`);
            } else if (typeof value === 'object' && value !== null) {
                console.log(`  Keys: ${Object.keys(value)}`);
            } else {
                console.log(`  Value: ${value}`);
            }
        });
    }
    
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

        // Process different attachment formats
        let processedAttachments = [];
        
        // 1. Check for standard attachments array
        if (emailData.attachments && Array.isArray(emailData.attachments)) {
            console.log(`[${requestId}] Found standard attachments array:`, emailData.attachments.length);
            processedAttachments = emailData.attachments;
        }
        
        // 2. Check for Microsoft Graph metadata format
        else if (typeof emailData.attachments === 'string' && emailData.attachments.includes('@odata.')) {
            console.log(`[${requestId}] Found Microsoft Graph attachments metadata`);
            processedAttachments = parseMicrosoftGraphAttachments(emailData.attachments);
        }
        
        // 3. Check for hydrate format attachments (Outlook connector)
        // TODO: We need Zapier's access token to fetch actual file content
        const zapierAccessToken = req.headers['x-zapier-access-token'] || null;
        const hydrateAttachments = await parseOutlookHydrateAttachments(emailData, zapierAccessToken);
        if (hydrateAttachments.length > 0) {
            console.log(`[${requestId}] Found ${hydrateAttachments.length} hydrate attachments`);
            processedAttachments = processedAttachments.concat(hydrateAttachments);
        }
        
        // Update emailData with processed attachments
        emailData.attachments = processedAttachments;
        
        // Debug processed attachment data
        if (processedAttachments.length > 0) {
            console.log(`[${requestId}] Processed ${processedAttachments.length} attachment(s):`);
            processedAttachments.forEach((att, index) => {
                console.log(`[${requestId}] Attachment ${index + 1}:`, {
                    name: att.name,
                    size: att.size || (att.data ? att.data.length : 'unknown'),
                    type: att.content_type || att.type || 'unknown',
                    hasData: !!att.data,
                    source: att.source || 'standard'
                });
            });
        } else {
            console.log(`[${requestId}] No processable attachments found`);
            console.log(`[${requestId}] Available fields:`, Object.keys(emailData));
        }

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
        if (!emailData || typeof emailData !== 'object') {
            console.log(`[${requestId}] Invalid email data:`, emailData);
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email data format' 
            });
        }

        console.log(`\n=== [${requestId}] FIELD DETECTION ANALYSIS ===`);
        
        // Try to detect subject and from fields with various naming patterns
        let detectedSubject = emailData.subject 
            || emailData.email_subject 
            || emailData.Subject 
            || emailData['Subject'] 
            || (emailData.email && emailData.email.subject)
            || (emailData.message && emailData.message.subject);
            
        let detectedFrom = emailData.from 
            || emailData.email_from 
            || emailData.From 
            || emailData['From']
            || emailData.sender
            || (emailData.email && emailData.email.from)
            || (emailData.message && emailData.message.from);

        console.log(`Original subject: "${emailData.subject}" (${typeof emailData.subject})`);
        console.log(`Original from: "${emailData.from}" (${typeof emailData.from})`);
        console.log(`Detected subject: "${detectedSubject}" (${typeof detectedSubject})`);
        console.log(`Detected from: "${detectedFrom}" (${typeof detectedFrom})`);

        // Update emailData with detected values
        if (detectedSubject && !emailData.subject) {
            console.log(`[${requestId}] Using detected subject field`);
            emailData.subject = detectedSubject;
        }
        if (detectedFrom && !emailData.from) {
            console.log(`[${requestId}] Using detected from field`);
            emailData.from = detectedFrom;
        }

        if (!emailData.subject && !emailData.from) {
            console.log(`[${requestId}] Missing required email data after field detection`);
            console.log(`[${requestId}] Available fields: ${Object.keys(emailData).join(', ')}`);
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required email data (subject or from)', 
                received_data: emailData,
                available_fields: Object.keys(emailData),
                detected_subject: detectedSubject,
                detected_from: detectedFrom
            });
        }

        // Parse attachments if they come in Microsoft Graph format
        if (emailData.attachments) {
            if (typeof emailData.attachments === 'string') {
                // Microsoft Graph format - try to parse
                console.log(`[${requestId}] Parsing Microsoft Graph attachment format`);
                processedAttachments = parseMicrosoftGraphAttachments(emailData.attachments);
            } else if (Array.isArray(emailData.attachments)) {
                // Already in proper format
                processedAttachments = emailData.attachments;
            }
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
            attachments: processedAttachments
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

// Simple test webhook (accepts any data)
router.post('/test', (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Test webhook received`);
    console.log(`[${requestId}] Body:`, req.body);
    
    res.json({
        success: true,
        message: 'Test webhook received successfully',
        request_id: requestId,
        received_data: req.body,
        timestamp: new Date().toISOString()
    });
});

// Test hydrate decoding endpoint
router.post('/test-hydrate', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] Testing hydrate decoding`);
    
    try {
        const { hydrateString, zapierAccessToken } = req.body;
        
        if (!hydrateString) {
            return res.status(400).json({
                success: false,
                message: 'Missing hydrateString in request body'
            });
        }
        
        console.log(`[${requestId}] Hydrate string length:`, hydrateString.length);
        
        // Test the hydrate decoder
        const hydrateData = decodeHydrateContent(hydrateString);
        
        if (!hydrateData) {
            return res.json({
                success: false,
                message: 'Failed to decode hydrate content',
                request_id: requestId
            });
        }
        
        console.log(`[${requestId}] Decoded hydrate data:`, hydrateData);
        
        let fetchResult = null;
        if (zapierAccessToken && hydrateData.kwargs && hydrateData.kwargs.bundle) {
            console.log(`[${requestId}] Attempting to fetch attachment from Graph API...`);
            fetchResult = await fetchAttachmentFromHydrate(hydrateData, zapierAccessToken);
        }
        
        res.json({
            success: true,
            message: 'Hydrate content decoded successfully',
            request_id: requestId,
            hydrate_data: hydrateData,
            fetch_result: fetchResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`[${requestId}] Hydrate test error:`, error);
        res.status(500).json({
            success: false,
            message: 'Error testing hydrate decoding',
            error: error.message,
            request_id: requestId
        });
    }
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