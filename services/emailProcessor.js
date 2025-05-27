const emailConfigService = require('./emailConfigService');
const emailFilingService = require('./emailFilingService');
const graphService = require('./graphService');
const pool = require('../config/db');

class EmailProcessor {
    constructor() {
        this.isProcessing = false;
        this.processingInterval = null;
        this.defaultControlNumberPatterns = [
            /ID:\s*(\d{1,9})\b/i,           // Primary: Look for "ID:" followed by control number (e.g., "ID:10000")
            /^(?:RE:\s*)?ID:\s*(\d{1,9})\b/i, // Secondary: "RE: ID:10000" at start of subject
            /\bID:\s*(\d{1,9})\b/gi        // Fallback: "ID:" pattern anywhere in content
        ];
    }

    // Start email processing for all active configurations
    async startProcessing(intervalMinutes = 5) {
        if (this.processingInterval) {
            console.log('Email processing already running');
            return;
        }

        console.log(`Starting email processing every ${intervalMinutes} minutes`);
        
        // Process immediately, then on interval
        this.processAllInstances();
        
        this.processingInterval = setInterval(() => {
            this.processAllInstances();
        }, intervalMinutes * 60 * 1000);
    }

    // Stop email processing
    stopProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('Email processing stopped');
        }
    }

    // Process emails for all active instances
    async processAllInstances() {
        if (this.isProcessing) {
            console.log('Email processing already in progress, skipping...');
            return;
        }

        this.isProcessing = true;
        console.log('=== STARTING EMAIL PROCESSING CYCLE ===');

        try {
            // Get all instances with active email configurations
            const result = await pool.query(`
                SELECT 
                    ii.instance_id,
                    ii.name as instance_name,
                    ec.config_type,
                    ec.email_address,
                    ec.auto_extract_control_numbers,
                    ec.include_attachments,
                    ec.default_folder_id
                FROM ims_instances ii
                JOIN email_configurations ec ON ii.instance_id = ec.instance_id
                WHERE ii.email_status = 'active'
                  AND ec.test_status = 'success'
            `);

            console.log(`Found ${result.rows.length} active email configurations`);

            for (const config of result.rows) {
                await this.processInstanceEmails(config);
            }
        } catch (error) {
            console.error('Error in email processing cycle:', error);
        } finally {
            this.isProcessing = false;
            console.log('=== EMAIL PROCESSING CYCLE COMPLETE ===');
        }
    }

    // Process emails for a specific instance
    async processInstanceEmails(instanceConfig) {
        try {
            console.log(`\n--- Processing emails for instance: ${instanceConfig.instance_name} ---`);
            console.log(`Email address: ${instanceConfig.email_address}`);

            // Get email configuration with credentials
            const fullConfig = await emailConfigService.getEmailConfig(instanceConfig.instance_id);
            if (!fullConfig) {
                console.log('No full configuration found, skipping...');
                return;
            }

            // Get unprocessed emails
            const emails = await this.getUnprocessedEmails(fullConfig);
            console.log(`Found ${emails.length} unprocessed emails`);
            
            if (emails.length > 0) {
                console.log('Unprocessed emails:');
                emails.forEach((email, index) => {
                    console.log(`  ${index + 1}. "${email.subject}" from ${email.from}`);
                });
            }

            for (const email of emails) {
                await this.processEmail(instanceConfig, fullConfig, email);
            }
        } catch (error) {
            console.error(`Error processing emails for instance ${instanceConfig.instance_name}:`, error);
        }
    }

    // Get unprocessed emails from mailbox
    async getUnprocessedEmails(config) {
        try {
            let emails = [];

            if (config.config_type === 'managed') {
                // Use our main Graph service for managed emails
                const originalEmail = graphService.emailAddress;
                graphService.emailAddress = config.email_address;
                
                emails = await graphService.getRecentEmails(20); // Check last 20 emails
                
                graphService.emailAddress = originalEmail;
            } else if (config.config_type === 'client_hosted') {
                // Use client's Graph credentials
                emails = await this.getEmailsWithClientCredentials(config);
            }

            // Filter out emails we've already processed
            console.log('Checking which emails are unprocessed...');
            const unprocessed = [];
            for (const email of emails) {
                console.log(`Email: "${email.subject}" (ID: ${email.id.substring(0, 20)}...)`);
                const alreadyProcessed = await this.isEmailAlreadyProcessed(email.id);
                console.log(`  Already processed: ${alreadyProcessed}`);
                if (!alreadyProcessed) {
                    unprocessed.push(email);
                    console.log(`  ✅ Added to unprocessed list`);
                } else {
                    console.log(`  ⏭️ Skipping (already processed)`);
                }
            }

            console.log(`Total unprocessed emails: ${unprocessed.length}`);
            return unprocessed;
        } catch (error) {
            console.error('Error getting unprocessed emails:', error);
            return [];
        }
    }

    // Get emails using client credentials
    async getEmailsWithClientCredentials(config) {
        try {
            const { Client } = require('@microsoft/microsoft-graph-client');
            const axios = require('axios');

            // Get access token
            const tokenUrl = `https://login.microsoftonline.com/${config.graph_tenant_id}/oauth2/v2.0/token`;
            
            const params = new URLSearchParams();
            params.append('client_id', config.graph_client_id);
            params.append('client_secret', config.graph_client_secret);
            params.append('scope', 'https://graph.microsoft.com/.default');
            params.append('grant_type', 'client_credentials');

            const tokenResponse = await axios.post(tokenUrl, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const accessToken = tokenResponse.data.access_token;

            // Create Graph client
            const authProvider = {
                getAccessToken: async () => accessToken
            };

            const client = Client.initWithMiddleware({ authProvider });
            
            // Get recent emails including CC/BCC
            const messages = await client
                .api(`/users/${config.email_address}/messages`)
                .top(40) // Get more to account for filtering
                .select('id,subject,from,receivedDateTime,hasAttachments,toRecipients,ccRecipients')
                .orderby('receivedDateTime desc')
                .get();

            // Filter emails where our address appears in TO or CC
            const relevantEmails = messages.value.filter(msg => {
                const targetEmail = config.email_address.toLowerCase();
                
                // Check TO recipients
                const inTo = msg.toRecipients && msg.toRecipients.some(recipient => 
                    recipient.emailAddress && recipient.emailAddress.address.toLowerCase() === targetEmail
                );
                
                // Check CC recipients
                const inCc = msg.ccRecipients && msg.ccRecipients.some(recipient => 
                    recipient.emailAddress && recipient.emailAddress.address.toLowerCase() === targetEmail
                );
                
                return inTo || inCc;
            }).slice(0, 20); // Limit to 20 emails

            return relevantEmails.map(msg => ({
                id: msg.id,
                subject: msg.subject,
                from: msg.from ? msg.from.emailAddress.address : 'Unknown',
                receivedDateTime: msg.receivedDateTime,
                hasAttachments: msg.hasAttachments
            }));
        } catch (error) {
            console.error('Error getting emails with client credentials:', error);
            return [];
        }
    }

    // Check if email was already processed
    async isEmailAlreadyProcessed(messageId) {
        try {
            const result = await pool.query(
                'SELECT id FROM email_processing_logs WHERE message_id = $1',
                [messageId]
            );
            return result.rows.length > 0;
        } catch (error) {
            console.error('Error checking if email processed:', error);
            return false;
        }
    }

    // Process a single email
    async processEmail(instanceConfig, fullConfig, email) {
        try {
            console.log(`\nProcessing email: ${email.subject}`);
            
            // Extract control number
            const controlNumber = this.extractControlNumber(email.subject, fullConfig.control_number_patterns);
            
            if (!controlNumber) {
                console.log('No control number found, skipping email');
                await emailConfigService.logEmailProcessing(
                    instanceConfig.instance_id,
                    { ...email, control_number: null },
                    'skipped',
                    'No control number found in subject'
                );
                return;
            }

            console.log(`Found control number: ${controlNumber}`);

            // Log processing start
            await emailConfigService.logEmailProcessing(
                instanceConfig.instance_id,
                { ...email, control_number: controlNumber },
                'processing'
            );

            // Get full email content and attachments
            const fullEmail = await this.getFullEmailContent(fullConfig, email.id);
            
            if (!fullEmail) {
                throw new Error('Could not retrieve full email content');
            }

            // File email and attachments to IMS
            await this.fileEmailToIMS(instanceConfig, fullConfig, fullEmail, controlNumber);

            console.log(`Successfully processed email: ${email.subject}`);
            
        } catch (error) {
            console.error(`Error processing email ${email.subject}:`, error);
            
            // Log error - make sure controlNumber is available in scope
            const emailControlNumber = controlNumber || this.extractControlNumber(email.subject, fullConfig?.control_number_patterns);
            
            await emailConfigService.logEmailProcessing(
                instanceConfig.instance_id,
                { ...email, control_number: emailControlNumber },
                'error',
                error.message
            );
        }
    }

    // Extract control number from email subject
    extractControlNumber(subject, patterns = null) {
        const patternsToUse = patterns || this.defaultControlNumberPatterns.map(p => p.source);
        
        for (const patternStr of patternsToUse) {
            try {
                const pattern = new RegExp(patternStr, 'i');
                const match = subject.match(pattern);
                if (match) {
                    return match[1]; // Return first captured group
                }
            } catch (error) {
                console.error('Error with control number pattern:', patternStr, error);
            }
        }
        
        return null;
    }

    // Get full email content with attachments
    async getFullEmailContent(config, messageId) {
        try {
            if (config.config_type === 'managed') {
                // Use our main Graph service
                const originalEmail = graphService.emailAddress;
                graphService.emailAddress = config.email_address;
                
                const fullEmail = await graphService.getEmailWithAttachments(messageId);
                
                graphService.emailAddress = originalEmail;
                return fullEmail;
            } else {
                // Use client credentials (implement similar to getEmailsWithClientCredentials)
                return await this.getFullEmailWithClientCredentials(config, messageId);
            }
        } catch (error) {
            console.error('Error getting full email content:', error);
            return null;
        }
    }

    // Get full email with client credentials
    async getFullEmailWithClientCredentials(config, messageId) {
        // Implementation similar to graphService.getEmailWithAttachments
        // but using client credentials - simplified for now
        return null; // TODO: Implement this
    }

    // File email and attachments to IMS
    async fileEmailToIMS(instanceConfig, fullConfig, email, controlNumber) {
        try {
            // Get instance IMS configuration
            const imsInstance = await pool.query(
                'SELECT url, username, password FROM ims_instances WHERE instance_id = $1',
                [instanceConfig.instance_id]
            );

            if (imsInstance.rows.length === 0) {
                throw new Error('IMS instance configuration not found');
            }

            const imsConfig = imsInstance.rows[0];

            let filedDocuments = [];

            // File email body as HTML document
            if (email.bodyContent) {
                const emailDocumentData = {
                    name: `Email_${controlNumber}_${new Date().toISOString().split('T')[0]}.html`,
                    data: Buffer.from(email.bodyContent).toString('base64'),
                    description: `Email: ${email.subject}`,
                    contentType: 'text/html'
                };

                const documentGuid = await this.fileDocumentToIMS(imsConfig, emailDocumentData, controlNumber);
                if (documentGuid) {
                    filedDocuments.push({ type: 'email', guid: documentGuid, name: emailDocumentData.name });
                }
            }

            // File attachments
            if (fullConfig.include_attachments && email.attachments && email.attachments.length > 0) {
                for (const attachment of email.attachments) {
                    if (attachment.data) {
                        const attachmentData = {
                            name: attachment.name,
                            data: attachment.data, // Already base64
                            description: `Email attachment: ${attachment.name} (Control ${controlNumber})`,
                            contentType: attachment.contentType
                        };

                        const documentGuid = await this.fileDocumentToIMS(imsConfig, attachmentData, controlNumber);
                        if (documentGuid) {
                            filedDocuments.push({ type: 'attachment', guid: documentGuid, name: attachment.name });
                        }
                    }
                }
            }

            // Log successful filing with document details
            await pool.query(`
                UPDATE email_processing_logs 
                SET processing_status = 'filed',
                    filed_to_ims = true,
                    ims_document_guid = $2
                WHERE message_id = $1
            `, [email.id, filedDocuments.length > 0 ? filedDocuments[0].guid : null]);

            console.log(`📄 Filed ${filedDocuments.length} documents to IMS:`);
            filedDocuments.forEach(doc => {
                console.log(`   ${doc.type}: ${doc.name} (GUID: ${doc.guid})`);
            });

        } catch (error) {
            console.error('Error filing email to IMS:', error);
            throw error;
        }
    }

    // File a single document to IMS
    async fileDocumentToIMS(imsConfig, documentData, controlNumber) {
        try {
            console.log(`Filing document to IMS: ${documentData.name}`);
            console.log(`IMS URL: ${imsConfig.url}`);
            console.log(`Control number: ${controlNumber}`);

            // Use the emailFilingService directly with the control-based approach
            // First get the instance and validate the control number
            const authService = require('./authService');
            
            // Get IMS token
            const token = await authService.getToken(
                imsConfig.url,
                imsConfig.username,
                imsConfig.password
            );

            // Validate control number and get quote GUID
            const controlValidation = await emailFilingService.validateControlNumber({
                url: imsConfig.url,
                username: imsConfig.username,
                password: imsConfig.password
            }, token, controlNumber);
            
            if (!controlValidation || !controlValidation.QuoteGuid) {
                throw new Error(`Invalid control number: ${controlNumber}`);
            }

            // Get user GUID
            const userGuid = await authService.getUserGuid(
                imsConfig.url,
                imsConfig.username,
                imsConfig.password
            );

            // Upload document directly
            const documentGuid = await emailFilingService.uploadDocumentToIMSByControl(
                { url: imsConfig.url },
                token,
                documentData,
                controlValidation.QuoteGuid,
                userGuid,
                { default_folder_id: 3 }
            );
            
            const result = {
                success: true,
                documentGuid: documentGuid,
                quoteGuid: controlValidation.QuoteGuid
            };

            if (result && result.success) {
                console.log(`✅ Successfully filed document to IMS: ${documentData.name}`);
                console.log(`   Document GUID: ${result.documentGuid}`);
                console.log(`   Quote GUID: ${result.quoteGuid}`);
                return result.documentGuid;
            } else {
                throw new Error(`IMS filing failed: ${result ? result.message : 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error('Error filing document to IMS:', error);
            throw error;
        }
    }

    // Manual trigger for testing
    async processInstanceNow(instanceId) {
        try {
            const result = await pool.query(`
                SELECT 
                    ii.instance_id,
                    ii.name as instance_name,
                    ec.config_type,
                    ec.email_address,
                    ec.auto_extract_control_numbers,
                    ec.include_attachments,
                    ec.default_folder_id
                FROM ims_instances ii
                JOIN email_configurations ec ON ii.instance_id = ec.instance_id
                WHERE ii.instance_id = $1
                  AND ii.email_status = 'active'
            `, [instanceId]);

            if (result.rows.length === 0) {
                throw new Error('No active email configuration found for this instance');
            }

            await this.processInstanceEmails(result.rows[0]);
            return { success: true, message: 'Email processing completed' };
        } catch (error) {
            console.error('Error in manual email processing:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailProcessor();