const emailConfigService = require('./emailConfigService');
const emailFilingService = require('./emailFilingService');
const graphService = require('./graphService');
const PlusAddressEmailService = require('./plusAddressEmailService');
const plusAddressEmailService = new PlusAddressEmailService();
const pool = require('../config/db');

class EmailProcessorV2 {
    constructor() {
        this.isProcessing = false;
        this.processingInterval = null;
        this.defaultControlNumberPatterns = [
            /ID:\s*(\d{1,9})\b/i,
            /^(?:RE:\s*)?ID:\s*(\d{1,9})\b/i,
            /\bID:\s*(\d{1,9})\b/gi
        ];
    }

    // Start email processing
    async startProcessing(intervalMinutes = 5) {
        if (this.processingInterval) {
            console.log('Email processing already running');
            return;
        }

        console.log(`Starting email processing V2 (subdomain support) every ${intervalMinutes} minutes`);
        
        // Process immediately, then on interval
        this.processCatchAllEmails();
        
        this.processingInterval = setInterval(() => {
            this.processCatchAllEmails();
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

    // Process emails from catch-all inbox
    async processCatchAllEmails() {
        if (this.isProcessing) {
            console.log('Email processing already in progress, skipping...');
            return;
        }

        this.isProcessing = true;
        console.log('=== STARTING EMAIL PROCESSING CYCLE V2 (Plus Addressing) ===');

        try {
            // Get emails from the main documents inbox
            const mainEmail = plusAddressEmailService.baseEmail;
            console.log(`Checking main inbox: ${mainEmail}`);
            
            // Get last processed timestamp for catch-all
            const lastProcessed = await this.getLastProcessedTimestamp();
            console.log(`Getting emails newer than: ${lastProcessed}`);
            
            // Fetch emails from catch-all
            const emails = await this.getEmailsFromCatchAll(lastProcessed);
            console.log(`Found ${emails.length} new emails in catch-all`);
            
            // Process each email
            for (const email of emails) {
                await this.processEmail(email);
            }
            
            // Update last processed timestamp
            if (emails.length > 0) {
                await this.updateLastProcessedTimestamp(emails[emails.length - 1].receivedDateTime);
            }
            
        } catch (error) {
            console.error('Error in email processing cycle V2:', error);
        } finally {
            this.isProcessing = false;
            console.log('=== EMAIL PROCESSING CYCLE V2 (Plus Addressing) COMPLETE ===');
        }
    }

    // Get emails from catch-all inbox
    async getEmailsFromCatchAll(sinceTimestamp) {
        try {
            // Use the main graph service with base email
            const originalEmail = graphService.emailAddress;
            graphService.emailAddress = plusAddressEmailService.baseEmail;
            
            const emails = await graphService.getEmailsSinceTimestamp(sinceTimestamp);
            
            graphService.emailAddress = originalEmail;
            
            return emails;
        } catch (error) {
            console.error('Error getting emails from catch-all:', error);
            return [];
        }
    }

    // Process a single email
    async processEmail(email) {
        try {
            console.log(`\nProcessing email: ${email.subject}`);
            console.log(`To: ${email.to || 'Unknown'}`);
            
            // Check if already processed
            const alreadyProcessed = await this.isEmailAlreadyProcessed(email.id);
            if (alreadyProcessed) {
                console.log(`⏭️  Skipping already processed email: ${email.subject}`);
                return;
            }
            
            // Route email based on To address
            const routing = await this.routeEmail(email);
            if (!routing) {
                console.log(`❌ Could not route email: ${email.to || 'No recipient'}`);
                await this.logUnroutableEmail(email);
                return;
            }
            
            console.log(`✅ Routed to instance: ${routing.instance.name} (${routing.routingType})`);
            
            // Extract control number
            const controlNumber = this.extractControlNumber(email.subject, routing.config.control_number_patterns);
            console.log(`Control number: ${controlNumber || 'None found'}`);
            
            // Get full email content
            const fullEmail = await this.getFullEmailContent(email.id);
            if (!fullEmail) {
                throw new Error('Could not retrieve full email content');
            }
            
            // Log processing start
            await emailConfigService.logEmailProcessing(
                routing.instance.instance_id,
                { ...email, ...fullEmail, control_number: controlNumber },
                'processing'
            );
            
            // File to IMS if control number found
            if (controlNumber) {
                await this.fileEmailToIMS(routing.instance, routing.config, fullEmail, controlNumber);
            } else {
                console.log('No control number found - skipping IMS filing');
                await pool.query(`
                    UPDATE email_processing_logs 
                    SET processing_status = 'skipped',
                        error_message = 'No control number found'
                    WHERE message_id = $1
                `, [email.id]);
            }
            
            console.log(`✅ Successfully processed email: ${email.subject}`);
            
        } catch (error) {
            console.error(`Error processing email ${email.subject}:`, error);
            
            await pool.query(`
                INSERT INTO email_processing_logs 
                (message_id, subject, processing_status, error_message)
                VALUES ($1, $2, 'error', $3)
                ON CONFLICT (message_id) DO UPDATE
                SET processing_status = 'error', error_message = $3
            `, [email.id, email.subject, error.message]);
        }
    }

    // Route email to correct instance/config
    async routeEmail(email) {
        // Get the To address from email
        const toAddress = this.extractToAddress(email);
        if (!toAddress) {
            return null;
        }
        
        // Use plus addressing service to route
        return await plusAddressEmailService.routeEmail(toAddress);
    }

    // Extract To address from email
    extractToAddress(email) {
        // Check various fields where the To address might be
        if (email.to) return email.to;
        if (email.toRecipients && email.toRecipients.length > 0) {
            return email.toRecipients[0].emailAddress.address;
        }
        // Additional fields can be checked here
        return null;
    }

    // Get full email content
    async getFullEmailContent(messageId) {
        try {
            const originalEmail = graphService.emailAddress;
            graphService.emailAddress = plusAddressEmailService.baseEmail;
            
            const fullEmail = await graphService.getEmailWithAttachments(messageId);
            
            graphService.emailAddress = originalEmail;
            return fullEmail;
        } catch (error) {
            console.error('Error getting full email content:', error);
            return null;
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

    // Extract control number from subject
    extractControlNumber(subject, patterns = null) {
        const patternsToUse = patterns || this.defaultControlNumberPatterns.map(p => p.source);
        
        for (const patternStr of patternsToUse) {
            try {
                const pattern = new RegExp(patternStr, 'i');
                const match = subject.match(pattern);
                if (match) {
                    return match[1];
                }
            } catch (error) {
                console.error('Error with control number pattern:', patternStr, error);
            }
        }
        
        return null;
    }

    // File email to IMS (reuse existing logic)
    async fileEmailToIMS(instance, config, email, controlNumber) {
        // This is the same as the original emailProcessor
        const emailProcessor = require('./emailProcessor');
        return await emailProcessor.fileEmailToIMS(
            { instance_id: instance.instance_id, ...config },
            config,
            email,
            controlNumber
        );
    }

    // Log unroutable email
    async logUnroutableEmail(email) {
        try {
            await pool.query(`
                INSERT INTO email_processing_logs 
                (message_id, email_address, subject, processing_status, error_message)
                VALUES ($1, $2, $3, 'unroutable', 'Could not determine destination')
            `, [email.id, email.to || 'Unknown', email.subject]);
        } catch (error) {
            console.error('Error logging unroutable email:', error);
        }
    }

    // Get last processed timestamp for catch-all
    async getLastProcessedTimestamp() {
        try {
            // Store this in a system config table or use a special record
            const result = await pool.query(`
                SELECT value FROM system_config 
                WHERE key = 'catch_all_last_processed'
            `);
            
            if (result.rows.length > 0) {
                return result.rows[0].value;
            }
            
            // Default to 1 hour ago
            return new Date(Date.now() - 60 * 60 * 1000).toISOString();
        } catch (error) {
            // Table might not exist yet
            return new Date(Date.now() - 60 * 60 * 1000).toISOString();
        }
    }

    // Update last processed timestamp
    async updateLastProcessedTimestamp(timestamp) {
        try {
            await pool.query(`
                INSERT INTO system_config (key, value) 
                VALUES ('catch_all_last_processed', $1)
                ON CONFLICT (key) DO UPDATE SET value = $1
            `, [timestamp]);
        } catch (error) {
            console.error('Error updating last processed timestamp:', error);
        }
    }
}

module.exports = new EmailProcessorV2();