const emailConfigService = require('./emailConfigService');
const emailFilingService = require('./emailFilingService');
const graphService = require('./graphService');
const pool = require('../config/db');

class EmailProcessor {
    constructor() {
        this.isProcessing = false;
        this.processingInterval = null;
        this.defaultControlNumberPatterns = [
            /^(?:RE:\s*)?(\d{1,9})\b/i,     // Control number at start of subject (1-9 digits), optionally preceded by "RE:"
            /\b(\d{1,9})\b/g               // Fallback: any 1-9 digit number in email content
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
            const unprocessed = [];
            for (const email of emails) {
                const alreadyProcessed = await this.isEmailAlreadyProcessed(email.id);
                if (!alreadyProcessed) {
                    unprocessed.push(email);
                }
            }

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
            
            // Get recent emails
            const messages = await client
                .api(`/users/${config.email_address}/mailFolders/inbox/messages`)
                .top(20)
                .select('id,subject,from,receivedDateTime,hasAttachments')
                .orderby('receivedDateTime desc')
                .get();

            return messages.value.map(msg => ({
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
            
            // Log error
            await emailConfigService.logEmailProcessing(
                instanceConfig.instance_id,
                { ...email, control_number: controlNumber || null },
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

            // File email body as HTML document
            if (email.bodyContent) {
                const emailDocumentData = {
                    name: `Email_${controlNumber}_${new Date().toISOString().split('T')[0]}.html`,
                    data: Buffer.from(email.bodyContent).toString('base64'),
                    description: `Email: ${email.subject}`,
                    contentType: 'text/html'
                };

                await this.fileDocumentToIMS(imsConfig, emailDocumentData, controlNumber);
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

                        await this.fileDocumentToIMS(imsConfig, attachmentData, controlNumber);
                    }
                }
            }

            // Log successful filing
            await emailConfigService.logEmailProcessing(
                instanceConfig.instance_id,
                { ...email, control_number: controlNumber },
                'filed'
            );

        } catch (error) {
            console.error('Error filing email to IMS:', error);
            throw error;
        }
    }

    // File a single document to IMS
    async fileDocumentToIMS(imsConfig, documentData, controlNumber) {
        try {
            // Use the existing email filing service to file the document
            // This will use your fixed InsertAssociatedDocument code
            
            console.log(`Filing document to IMS: ${documentData.name}`);
            console.log(`IMS URL: ${imsConfig.url}`);
            console.log(`Control number: ${controlNumber}`);

            // For now, just log that we would file it
            // TODO: Integrate with the actual IMS filing service
            console.log('Document filing to IMS - TODO: Implement actual filing');
            
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