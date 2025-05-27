const pool = require('../config/db');
const crypto = require('crypto');

class EmailConfigService {
    constructor() {
        this.encryptionKey = process.env.EMAIL_CONFIG_ENCRYPTION_KEY || 'your-32-char-secret-key-here!!!';
        this.algorithm = 'aes-256-gcm';
    }

    // Encrypt sensitive data
    encrypt(text) {
        if (!text) return null;
        
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    // Decrypt sensitive data
    decrypt(encryptedData) {
        if (!encryptedData || !encryptedData.encrypted) return null;
        
        try {
            const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    // Get email configuration for an instance
    async getEmailConfig(instanceId) {
        try {
            const result = await pool.query(`
                SELECT 
                    ec.*,
                    ii.name as instance_name,
                    ii.email_status
                FROM email_configurations ec
                JOIN ims_instances ii ON ec.instance_id = ii.instance_id
                WHERE ec.instance_id = $1
            `, [instanceId]);

            if (result.rows.length === 0) {
                return null;
            }

            const config = result.rows[0];

            // Decrypt sensitive fields if they exist
            if (config.graph_client_id_encrypted) {
                config.graph_client_id = this.decrypt(JSON.parse(config.graph_client_id_encrypted));
            }
            if (config.graph_client_secret_encrypted) {
                config.graph_client_secret = this.decrypt(JSON.parse(config.graph_client_secret_encrypted));
            }
            if (config.graph_tenant_id_encrypted) {
                config.graph_tenant_id = this.decrypt(JSON.parse(config.graph_tenant_id_encrypted));
            }

            return config;
        } catch (error) {
            console.error('Error getting email config:', error);
            throw error;
        }
    }

    // Get default control number patterns
    getDefaultControlNumberPatterns() {
        return [
            'ID:\\s*(\\d{1,9})\\b',           // Primary: Look for "ID:" followed by control number
            '^(?:RE:\\s*)?ID:\\s*(\\d{1,9})\\b', // Secondary: "RE: ID:10000" at start of subject  
            '\\bID:\\s*(\\d{1,9})\\b'          // Fallback: "ID:" pattern anywhere in content
        ];
    }

    // Create managed email configuration
    async createManagedEmailConfig(instanceId, instanceName) {
        try {
            // Generate unique email address
            const emailAddress = `documents-${instanceName.toLowerCase().replace(/[^a-z0-9]/g, '')}@42consultingllc.com`;
            const defaultPatterns = this.getDefaultControlNumberPatterns();

            const result = await pool.query(`
                INSERT INTO email_configurations 
                (instance_id, config_type, email_address, auto_extract_control_numbers, include_attachments, control_number_patterns)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [instanceId, 'managed', emailAddress, true, true, defaultPatterns]);

            // Update instance status
            await pool.query(`
                UPDATE ims_instances 
                SET email_status = 'active',
                    email_config = $2
                WHERE instance_id = $1
            `, [instanceId, JSON.stringify({
                type: 'managed',
                email_address: emailAddress,
                status: 'active',
                created_at: new Date().toISOString()
            })]);

            return result.rows[0];
        } catch (error) {
            console.error('Error creating managed email config:', error);
            throw error;
        }
    }

    // Create client-hosted email configuration
    async createClientHostedEmailConfig(instanceId, configData) {
        try {
            const {
                email_address,
                graph_client_id,
                graph_client_secret,
                graph_tenant_id,
                auto_extract_control_numbers = true,
                include_attachments = true,
                default_folder_id = 3
            } = configData;

            // Encrypt sensitive data
            const encryptedClientId = this.encrypt(graph_client_id);
            const encryptedClientSecret = this.encrypt(graph_client_secret);
            const encryptedTenantId = this.encrypt(graph_tenant_id);

            const defaultPatterns = this.getDefaultControlNumberPatterns();

            const result = await pool.query(`
                INSERT INTO email_configurations 
                (instance_id, config_type, email_address, 
                 graph_client_id_encrypted, graph_client_secret_encrypted, graph_tenant_id_encrypted,
                 auto_extract_control_numbers, include_attachments, default_folder_id, control_number_patterns)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                instanceId, 
                'client_hosted', 
                email_address,
                JSON.stringify(encryptedClientId),
                JSON.stringify(encryptedClientSecret),
                JSON.stringify(encryptedTenantId),
                auto_extract_control_numbers,
                include_attachments,
                default_folder_id,
                defaultPatterns
            ]);

            // Update instance status
            await pool.query(`
                UPDATE ims_instances 
                SET email_status = 'configuring',
                    email_config = $2
                WHERE instance_id = $1
            `, [instanceId, JSON.stringify({
                type: 'client_hosted',
                email_address: email_address,
                status: 'configuring',
                created_at: new Date().toISOString()
            })]);

            return result.rows[0];
        } catch (error) {
            console.error('Error creating client-hosted email config:', error);
            throw error;
        }
    }

    // Test email configuration
    async testEmailConfig(instanceId) {
        try {
            const config = await this.getEmailConfig(instanceId);
            if (!config) {
                throw new Error('No email configuration found');
            }

            let testResult = { success: false, error: 'Unknown error' };

            if (config.config_type === 'managed') {
                // For managed configs, test our internal Graph API access
                testResult = await this.testManagedConfig(config);
            } else if (config.config_type === 'client_hosted') {
                // For client-hosted, test their Graph API credentials
                testResult = await this.testClientHostedConfig(config);
            }

            // Update test results
            await pool.query(`
                UPDATE email_configurations 
                SET last_tested_at = CURRENT_TIMESTAMP,
                    test_status = $2,
                    test_error = $3
                WHERE instance_id = $1
            `, [instanceId, testResult.success ? 'success' : 'failed', testResult.error]);

            // Update instance status
            const newStatus = testResult.success ? 'active' : 'error';
            await pool.query(`
                UPDATE ims_instances 
                SET email_status = $2
                WHERE instance_id = $1
            `, [instanceId, newStatus]);

            return testResult;
        } catch (error) {
            console.error('Error testing email config:', error);
            throw error;
        }
    }

    // Test managed email configuration
    async testManagedConfig(config) {
        try {
            // Use our main Graph service to test access
            const graphService = require('./graphService');
            
            // Temporarily set the email address
            const originalEmail = graphService.emailAddress;
            graphService.emailAddress = config.email_address;
            
            const testResult = await graphService.testConnection();
            
            // Restore original email
            graphService.emailAddress = originalEmail;
            
            return testResult;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Test client-hosted email configuration  
    async testClientHostedConfig(config) {
        try {
            // Create a temporary Graph service instance with client credentials
            const { Client } = require('@microsoft/microsoft-graph-client');
            const axios = require('axios');

            // Get access token using client credentials
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

            // Test Graph API access
            const authProvider = {
                getAccessToken: async () => accessToken
            };

            const client = Client.initWithMiddleware({ authProvider });
            
            // Try to access the specified mailbox
            const user = await client.api(`/users/${config.email_address}`).get();
            
            return { 
                success: true, 
                user: {
                    displayName: user.displayName,
                    mail: user.mail,
                    userPrincipalName: user.userPrincipalName
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Log email processing attempt
    async logEmailProcessing(instanceId, emailData, status, error = null) {
        try {
            await pool.query(`
                INSERT INTO email_processing_logs 
                (instance_id, email_address, message_id, subject, control_number, 
                 processing_status, error_message, attachments_count)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                instanceId,
                emailData.from || emailData.email_address,
                emailData.message_id || emailData.id,
                emailData.subject,
                emailData.control_number,
                status,
                error,
                emailData.attachments ? emailData.attachments.length : 0
            ]);
        } catch (error) {
            console.error('Error logging email processing:', error);
        }
    }

    // Test specific email configuration
    async testSpecificEmailConfig(instanceId, configId) {
        try {
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
                throw new Error('Configuration not found');
            }

            const config = result.rows[0];

            // Decrypt sensitive fields if they exist
            if (config.graph_client_id_encrypted) {
                config.graph_client_id = this.decrypt(JSON.parse(config.graph_client_id_encrypted));
            }
            if (config.graph_client_secret_encrypted) {
                config.graph_client_secret = this.decrypt(JSON.parse(config.graph_client_secret_encrypted));
            }
            if (config.graph_tenant_id_encrypted) {
                config.graph_tenant_id = this.decrypt(JSON.parse(config.graph_tenant_id_encrypted));
            }

            let testResult = { success: false, error: 'Unknown error' };

            if (config.config_type === 'managed') {
                testResult = await this.testManagedConfig(config);
            } else if (config.config_type === 'client_hosted') {
                testResult = await this.testClientHostedConfig(config);
            }

            // Update test results for this specific config
            await pool.query(`
                UPDATE email_configurations 
                SET last_tested_at = CURRENT_TIMESTAMP,
                    test_status = $2,
                    test_error = $3
                WHERE id = $1
            `, [configId, testResult.success ? 'success' : 'failed', testResult.error]);

            return testResult;
        } catch (error) {
            console.error('Error testing specific email config:', error);
            throw error;
        }
    }

    // Test all email configurations for an instance
    async testAllEmailConfigs(instanceId) {
        try {
            const result = await pool.query(`
                SELECT id, config_type, email_address
                FROM email_configurations 
                WHERE instance_id = $1
            `, [instanceId]);

            const results = {
                total: result.rows.length,
                passed: 0,
                failed: 0,
                details: []
            };

            for (const config of result.rows) {
                try {
                    const testResult = await this.testSpecificEmailConfig(instanceId, config.id);
                    
                    if (testResult.success) {
                        results.passed++;
                    } else {
                        results.failed++;
                    }

                    results.details.push({
                        configId: config.id,
                        configType: config.config_type,
                        emailAddress: config.email_address,
                        success: testResult.success,
                        error: testResult.error
                    });
                } catch (error) {
                    results.failed++;
                    results.details.push({
                        configId: config.id,
                        configType: config.config_type,
                        emailAddress: config.email_address,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Update instance status based on overall results
            const hasActiveConfig = results.passed > 0;
            const newStatus = hasActiveConfig ? 'active' : (results.total > 0 ? 'error' : 'not_configured');
            
            await pool.query(`
                UPDATE ims_instances 
                SET email_status = $2
                WHERE instance_id = $1
            `, [instanceId, newStatus]);

            return results;
        } catch (error) {
            console.error('Error testing all email configs:', error);
            throw error;
        }
    }

    // Get email processing stats for an instance
    async getEmailStats(instanceId, days = 30) {
        try {
            const result = await pool.query(`
                SELECT 
                    processing_status,
                    COUNT(*) as count,
                    DATE(processed_at) as date
                FROM email_processing_logs 
                WHERE instance_id = $1 
                  AND processed_at >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY processing_status, DATE(processed_at)
                ORDER BY date DESC
            `, [instanceId]);

            return result.rows;
        } catch (error) {
            console.error('Error getting email stats:', error);
            throw error;
        }
    }
}

module.exports = new EmailConfigService();