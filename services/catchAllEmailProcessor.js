const pool = require('../config/db');
const graphService = require('./graphService');
const emailFilingService = require('./emailFilingService');
const authService = require('./authService');

class CatchAllEmailProcessor {
    constructor() {
        this.CATCH_ALL_INBOX = 'documents@42consultingllc.com';
        this.isProcessing = false;
        this.configCache = null;
        this.cacheExpiry = null;
        this.processingInterval = null;
    }

    /**
     * Start the email processing cron job
     */
    startProcessing(intervalMinutes = 5) {
        if (this.processingInterval) {
            console.log('Email processing already running');
            return;
        }

        console.log(`Starting catch-all email processing every ${intervalMinutes} minutes`);
        
        // Process immediately, then on interval
        this.processAllEmails();
        
        this.processingInterval = setInterval(() => {
            this.processAllEmails();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Stop the email processing
     */
    stopProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('Email processing stopped');
        }
    }

    /**
     * Main processing function - gets all emails from catch-all and routes them
     */
    async processAllEmails() {
        if (this.isProcessing) {
            console.log('Email processing already in progress, skipping...');
            return;
        }

        this.isProcessing = true;
        console.log('=== STARTING CATCH-ALL EMAIL PROCESSING ===');

        try {
            // 1. Get last processed timestamp
            const lastProcessed = await this.getLastProcessedTimestamp();
            console.log(`Processing emails newer than: ${lastProcessed}`);

            // 2. Get ALL new emails from catch-all inbox
            const allEmails = await this.getEmailsFromCatchAll(lastProcessed);
            console.log(`Found ${allEmails.length} new emails in catch-all`);

            if (allEmails.length === 0) {
                console.log('No new emails to process');
                return;
            }

            // 3. Load all active configurations
            const configs = await this.loadAllConfigurations();
            console.log(`Loaded ${configs.size} active email configurations`);

            // 4. Process each email
            let processedCount = 0;
            let routedCount = 0;

            for (const email of allEmails) {
                try {
                    // Check if already processed
                    const alreadyProcessed = await this.isEmailProcessed(email.id);
                    if (alreadyProcessed) {
                        console.log(`Skipping already processed email: ${email.subject}`);
                        continue;
                    }

                    // Route the email
                    const routed = await this.routeEmail(email, configs);
                    if (routed) {
                        routedCount++;
                    }
                    processedCount++;
                } catch (error) {
                    console.error(`Error processing email ${email.id}:`, error);
                    await this.logProcessingError(email, error);
                }
            }

            // 5. Update last processed timestamp
            if (allEmails.length > 0) {
                const latestEmail = allEmails[0]; // Emails are ordered by date desc
                await this.updateLastProcessedTimestamp(latestEmail.receivedDateTime);
            }

            console.log(`Processed ${processedCount} emails, routed ${routedCount} to instances`);

        } catch (error) {
            console.error('Error in catch-all email processing:', error);
        } finally {
            this.isProcessing = false;
            console.log('=== CATCH-ALL EMAIL PROCESSING COMPLETE ===');
        }
    }

    /**
     * Get emails from the catch-all inbox
     */
    async getEmailsFromCatchAll(sinceTimestamp) {
        try {
            // Use the main graph service to get emails
            const originalEmail = graphService.emailAddress;
            graphService.emailAddress = this.CATCH_ALL_INBOX;
            
            const emails = await graphService.getEmailsSinceTimestamp(sinceTimestamp);
            
            graphService.emailAddress = originalEmail;
            return emails;
        } catch (error) {
            console.error('Error getting emails from catch-all:', error);
            return [];
        }
    }

    /**
     * Load all active email configurations with caching
     */
    async loadAllConfigurations() {
        // Check cache
        if (this.configCache && this.cacheExpiry > Date.now()) {
            return this.configCache;
        }

        const result = await pool.query(`
            SELECT 
                ec.id as config_id,
                ec.instance_id,
                ec.email_prefix,
                ec.control_number_patterns,
                ec.default_folder_id,
                ec.include_attachments,
                ec.auto_extract_control_numbers,
                ii.email_subdomain,
                ii.name as instance_name,
                ii.url as instance_url,
                ii.username,
                ii.password
            FROM email_configurations ec
            JOIN ims_instances ii ON ec.instance_id = ii.instance_id
            WHERE ii.email_status = 'active'
            AND ec.test_status = 'success'
        `);

        // Build lookup map by subdomain-prefix
        this.configCache = new Map();
        for (const row of result.rows) {
            const key = `${row.email_subdomain}-${row.email_prefix}`;
            this.configCache.set(key.toLowerCase(), row);
        }

        this.cacheExpiry = Date.now() + 60000; // Cache for 1 minute
        return this.configCache;
    }

    /**
     * Route an email to the appropriate configuration
     */
    async routeEmail(email, configs) {
        // Parse the recipient 
        const recipient = await this.parseRecipient(email);
        
        if (!recipient) {
            console.log(`No valid recipient found in email: ${email.subject}`);
            return false;
        }

        console.log(`Routing email to: ${recipient.email} (${recipient.prefix} for ${recipient.uniqueId})`);

        // Find configuration by unique identifier and prefix
        const configKey = `${recipient.uniqueId}-${recipient.prefix}`;
        const fullConfig = configs.get(configKey);

        if (!fullConfig) {
            console.log(`No configuration found for ${recipient.email}`);
            await this.logUnroutableEmail(email, recipient);
            return false;
        }

        // Process the email for this configuration
        await this.processEmailForConfig(email, fullConfig);
        return true;
    }


    /**
     * Parse recipient from email TO field
     */
    async parseRecipient(email) {
        // Debug: Log all recipients
        console.log(`DEBUG - Parsing recipients for email: ${email.subject}`);
        
        // Check TO recipients
        if (!email.toRecipients || email.toRecipients.length === 0) {
            console.log('DEBUG - No toRecipients found');
            return null;
        }

        console.log(`DEBUG - Found ${email.toRecipients.length} TO recipients:`);
        email.toRecipients.forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.emailAddress.address}`);
        });

        for (const recipient of email.toRecipients) {
            const address = recipient.emailAddress.address.toLowerCase();
            
            // Match format: prefix-uniqueid@42ims.com
            const match = address.match(/^([a-z0-9._-]+)-([a-z0-9-]+)@42ims\.com$/);
            if (match) {
                console.log(`DEBUG - Found matching address: ${address} -> prefix: ${match[1]}, uniqueId: ${match[2]}`);
                return {
                    email: address,
                    prefix: match[1],
                    uniqueId: match[2]
                };
            } else {
                console.log(`DEBUG - Address ${address} does not match pattern`);
            }
        }

        // Check CC as fallback
        if (email.ccRecipients) {
            for (const recipient of email.ccRecipients) {
                const address = recipient.emailAddress.address.toLowerCase();
                
                // Match format: prefix-uniqueid@42ims.com
                const match = address.match(/^([a-z0-9._-]+)-([a-z0-9-]+)@42ims\.com$/);
                if (match) {
                    return {
                        email: address,
                        prefix: match[1],
                        uniqueId: match[2],
                        fromCC: true
                    };
                }
            }
        }

        return null;
    }

    /**
     * Process an email for a specific configuration
     */
    async processEmailForConfig(email, config) {
        try {
            console.log(`Processing email for ${config.instance_name} - ${config.email_prefix}`);

            // Extract control number
            const controlNumber = this.extractControlNumber(
                email.subject, 
                config.control_number_patterns
            );

            if (!controlNumber && config.auto_extract_control_numbers) {
                console.log('No control number found, skipping...');
                await this.logProcessing(email, config, 'no_control_number');
                return;
            }

            // Get full email content
            const fullEmail = await this.getFullEmailContent(email.id);
            if (!fullEmail) {
                throw new Error('Could not retrieve full email content');
            }

            // Log processing start
            await this.logProcessing(email, config, 'processing', controlNumber);

            // File to IMS
            await this.fileEmailToIMS(config, fullEmail, controlNumber);

            // Log success
            await this.logProcessing(email, config, 'filed', controlNumber);

        } catch (error) {
            console.error(`Error processing email for config ${config.config_id}:`, error);
            await this.logProcessing(email, config, 'error', null, error.message);
        }
    }

    /**
     * Get full email content including attachments
     */
    async getFullEmailContent(messageId) {
        try {
            const originalEmail = graphService.emailAddress;
            graphService.emailAddress = this.CATCH_ALL_INBOX;
            
            const fullEmail = await graphService.getEmailWithAttachments(messageId);
            
            graphService.emailAddress = originalEmail;
            return fullEmail;
        } catch (error) {
            console.error('Error getting full email content:', error);
            return null;
        }
    }

    /**
     * Extract control number from email subject
     */
    extractControlNumber(subject, patterns) {
        if (!patterns || patterns.length === 0) {
            patterns = [
                'ID:\\s*(\\d{1,9})\\b',
                '^(?:RE:\\s*)?ID:\\s*(\\d{1,9})\\b',
                '\\bID:\\s*(\\d{1,9})\\b'
            ];
        }

        for (const pattern of patterns) {
            try {
                const regex = new RegExp(pattern, 'i');
                const match = subject.match(regex);
                if (match && match[1]) {
                    return match[1];
                }
            } catch (error) {
                console.error('Invalid regex pattern:', pattern);
            }
        }

        return null;
    }

    /**
     * File email and attachments to IMS
     */
    async fileEmailToIMS(config, email, controlNumber) {
        const imsConfig = {
            url: config.instance_url,
            username: config.username,
            password: config.password
        };

        // Get auth token
        const token = await authService.getToken(
            imsConfig.url,
            imsConfig.username,
            imsConfig.password
        );

        // Validate control number
        const validation = await emailFilingService.validateControlNumber(
            imsConfig,
            token,
            controlNumber
        );

        if (!validation || !validation.QuoteGuid) {
            throw new Error(`Invalid control number: ${controlNumber}`);
        }

        // Get user GUID
        const userGuid = await authService.getUserGuid(
            imsConfig.url,
            imsConfig.username,
            imsConfig.password
        );

        // Upload email
        const emailDoc = {
            name: `Email_${controlNumber}_${new Date().toISOString().split('T')[0]}.html`,
            data: Buffer.from(email.bodyContent).toString('base64'),
            description: `Email: ${email.subject}`,
            contentType: 'text/html'
        };

        await emailFilingService.uploadDocumentToIMSByControl(
            imsConfig,
            token,
            emailDoc,
            validation.QuoteGuid,
            userGuid,
            { default_folder_id: config.default_folder_id }
        );

        // Upload attachments if enabled
        if (config.include_attachments && email.attachments) {
            for (const attachment of email.attachments) {
                if (attachment.data) {
                    await emailFilingService.uploadDocumentToIMSByControl(
                        imsConfig,
                        token,
                        {
                            name: attachment.name,
                            data: attachment.data,
                            description: `Email attachment: ${attachment.name}`,
                            contentType: attachment.contentType
                        },
                        validation.QuoteGuid,
                        userGuid,
                        { default_folder_id: config.default_folder_id }
                    );
                }
            }
        }
    }

    /**
     * Database helper methods
     */
    async getLastProcessedTimestamp() {
        const result = await pool.query(
            "SELECT value FROM system_config WHERE key = 'catch_all_last_processed'"
        );
        return result.rows[0]?.value || '2024-01-01T00:00:00Z';
    }

    async updateLastProcessedTimestamp(timestamp) {
        await pool.query(`
            INSERT INTO system_config (key, value) 
            VALUES ('catch_all_last_processed', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
        `, [timestamp]);
    }

    async isEmailProcessed(messageId) {
        const result = await pool.query(
            'SELECT 1 FROM email_processing_logs WHERE message_id = $1',
            [messageId]
        );
        return result.rows.length > 0;
    }

    async logProcessing(email, config, status, controlNumber = null, errorMessage = null) {
        await pool.query(`
            INSERT INTO email_processing_logs 
            (instance_id, email_address, message_id, subject, control_number, 
             processing_status, error_message, attachments_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            config.instance_id,
            `${config.email_prefix}-${config.email_subdomain}@42ims.com`,
            email.id,
            email.subject,
            controlNumber,
            status,
            errorMessage,
            email.hasAttachments ? 1 : 0
        ]);
    }

    async logUnroutableEmail(email, recipient) {
        await pool.query(`
            INSERT INTO email_processing_logs 
            (instance_id, email_address, message_id, subject, processing_status, error_message)
            VALUES (NULL, $1, $2, $3, 'unroutable', 'No configuration found for this email address')
        `, [recipient.email, email.id, email.subject]);
    }

    async logProcessingError(email, error) {
        await pool.query(`
            INSERT INTO email_processing_logs 
            (instance_id, email_address, message_id, subject, processing_status, error_message)
            VALUES (NULL, 'unknown', $1, $2, 'error', $3)
        `, [email.id, email.subject, error.message]);
    }
}

module.exports = new CatchAllEmailProcessor();