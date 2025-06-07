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

    // Initialize email configurations table with timestamp column
    async initializeSchema() {
        try {
            // Add last_processed_timestamp column if it doesn't exist
            await pool.query(`
                ALTER TABLE email_configurations 
                ADD COLUMN IF NOT EXISTS last_processed_timestamp TIMESTAMP WITH TIME ZONE 
                DEFAULT '2024-01-01T00:00:00Z'
            `);
            console.log('✅ Email configurations schema updated with timestamp tracking');
        } catch (error) {
            console.error('Error updating email configurations schema:', error);
        }
    }

    // Update last processed timestamp for an instance
    async updateLastProcessedTimestamp(instanceId, timestamp = null) {
        try {
            const processedAt = timestamp || new Date().toISOString();
            await pool.query(`
                UPDATE email_configurations 
                SET last_processed_timestamp = $1 
                WHERE instance_id = $2
            `, [processedAt, instanceId]);
            console.log(`Updated last processed timestamp for instance ${instanceId}: ${processedAt}`);
        } catch (error) {
            console.error('Error updating last processed timestamp:', error);
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

    // Create subdomain-based email configuration
    async createSubdomainEmailConfig(instanceId, emailPrefix, fullEmailAddress, defaultFolderId = 0) {
        try {
            // Default control number patterns
            const defaultPatterns = [
                'ID:\\s*(\\d{1,9})\\b',
                '^(?:RE:\\s*)?ID:\\s*(\\d{1,9})\\b',
                '\\bID:\\s*(\\d{1,9})\\b'
            ];

            const result = await pool.query(`
                INSERT INTO email_configurations 
                (instance_id, config_type, email_address, email_prefix, email_system_type,
                 auto_extract_control_numbers, control_number_patterns, 
                 include_attachments, default_folder_id, test_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                instanceId,
                'managed',
                fullEmailAddress,
                emailPrefix,
                'subdomain',  // Set system type to subdomain
                true,
                defaultPatterns,
                true,
                defaultFolderId,
                'success' // Managed emails are always ready
            ]);

            // Update instance status
            await pool.query(`
                UPDATE ims_instances 
                SET email_status = 'active'
                WHERE instance_id = $1
            `, [instanceId]);

            return result.rows[0];
        } catch (error) {
            console.error('Error creating subdomain email config:', error);
            throw error;
        }
    }

    // Create managed email configuration (legacy - kept for backward compatibility)
    async createManagedEmailConfig(instanceId, instanceName, defaultFolderId = 0) {
        try {
            // Generate unique email address
            const emailAddress = `documents-${instanceName.toLowerCase().replace(/[^a-z0-9]/g, '')}@42consultingllc.com`;
            const defaultPatterns = this.getDefaultControlNumberPatterns();

            const result = await pool.query(`
                INSERT INTO email_configurations 
                (instance_id, config_type, email_address, auto_extract_control_numbers, include_attachments, control_number_patterns, default_folder_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [instanceId, 'managed', emailAddress, true, true, defaultPatterns, defaultFolderId]);

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
            console.log('=== TESTING CLIENT-HOSTED EMAIL CONFIG ===');
            console.log('Email Address:', config.email_address);
            console.log('Tenant ID:', config.graph_tenant_id ? `${config.graph_tenant_id.substring(0, 8)}...` : 'Missing');
            console.log('Client ID:', config.graph_client_id ? `${config.graph_client_id.substring(0, 8)}...` : 'Missing');
            console.log('Client Secret:', config.graph_client_secret ? 'Present' : 'Missing');

            // Validate required fields
            if (!config.graph_tenant_id) {
                return { success: false, error: 'Directory (Tenant) ID is required', code: 'MISSING_TENANT_ID' };
            }
            if (!config.graph_client_id) {
                return { success: false, error: 'Application (Client) ID is required', code: 'MISSING_CLIENT_ID' };
            }
            if (!config.graph_client_secret) {
                return { success: false, error: 'Client Secret is required', code: 'MISSING_CLIENT_SECRET' };
            }
            if (!config.email_address) {
                return { success: false, error: 'Email address is required', code: 'MISSING_EMAIL' };
            }

            // Validate GUID format for tenant and client IDs
            const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!guidRegex.test(config.graph_tenant_id)) {
                return { success: false, error: 'Directory (Tenant) ID must be a valid GUID format', code: 'INVALID_TENANT_ID' };
            }
            if (!guidRegex.test(config.graph_client_id)) {
                return { success: false, error: 'Application (Client) ID must be a valid GUID format', code: 'INVALID_CLIENT_ID' };
            }

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

            console.log('Attempting to get access token...');
            let tokenResponse;
            try {
                tokenResponse = await axios.post(tokenUrl, params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000 // 10 second timeout
                });
            } catch (tokenError) {
                console.error('Token request failed:', tokenError.response?.data || tokenError.message);
                
                if (tokenError.response?.status === 400) {
                    const errorData = tokenError.response.data;
                    if (errorData.error === 'invalid_client') {
                        return { 
                            success: false, 
                            error: 'Invalid client credentials. Please check your Application (Client) ID and Client Secret.',
                            code: 'INVALID_CLIENT_CREDENTIALS',
                            details: errorData.error_description
                        };
                    } else if (errorData.error === 'invalid_request') {
                        return { 
                            success: false, 
                            error: 'Invalid request. Please check your Directory (Tenant) ID.',
                            code: 'INVALID_REQUEST',
                            details: errorData.error_description
                        };
                    }
                } else if (tokenError.response?.status === 401) {
                    return { 
                        success: false, 
                        error: 'Unauthorized. Please verify your Azure app registration settings and ensure admin consent has been granted.',
                        code: 'UNAUTHORIZED',
                        details: 'Check that your app has the required permissions (Mail.Read, User.Read.All) and admin consent was granted.'
                    };
                }
                
                return { 
                    success: false, 
                    error: `Authentication failed: ${tokenError.message}`,
                    code: 'AUTH_FAILED'
                };
            }

            if (!tokenResponse.data.access_token) {
                return { 
                    success: false, 
                    error: 'No access token received from Azure AD',
                    code: 'NO_ACCESS_TOKEN'
                };
            }

            console.log('✅ Access token obtained successfully');
            const accessToken = tokenResponse.data.access_token;

            // Test Graph API access
            const authProvider = {
                getAccessToken: async () => accessToken
            };

            const client = Client.initWithMiddleware({ authProvider });
            
            console.log(`Testing access to mailbox: ${config.email_address}`);
            let user;
            try {
                // Try to access the specified mailbox
                user = await client.api(`/users/${config.email_address}`).get();
                console.log('✅ Mailbox access successful');
            } catch (userError) {
                console.error('Mailbox access failed:', userError.message);
                
                if (userError.code === 'Request_ResourceNotFound') {
                    return { 
                        success: false, 
                        error: `Email address '${config.email_address}' was not found in your Azure AD tenant.`,
                        code: 'USER_NOT_FOUND',
                        details: 'Make sure the email address exists in your Microsoft 365 tenant and is spelled correctly.'
                    };
                } else if (userError.code === 'Forbidden') {
                    return { 
                        success: false, 
                        error: 'Access denied. Your app may not have the required permissions.',
                        code: 'INSUFFICIENT_PERMISSIONS',
                        details: 'Ensure your app registration has Mail.Read and User.Read.All permissions with admin consent granted.'
                    };
                } else if (userError.code === 'TooManyRequests') {
                    return { 
                        success: false, 
                        error: 'Too many requests. Please wait a moment and try again.',
                        code: 'RATE_LIMITED'
                    };
                }
                
                return { 
                    success: false, 
                    error: `Failed to access mailbox: ${userError.message}`,
                    code: 'MAILBOX_ACCESS_FAILED'
                };
            }

            // Test basic email access
            try {
                console.log('Testing basic email access...');
                const messages = await client
                    .api(`/users/${config.email_address}/messages`)
                    .top(1)
                    .select('id,subject,receivedDateTime')
                    .get();
                
                console.log(`✅ Email access successful. Found ${messages.value.length} message(s) in recent history.`);
            } catch (emailError) {
                console.error('Email access test failed:', emailError.message);
                
                if (emailError.code === 'Forbidden') {
                    return { 
                        success: false, 
                        error: 'Cannot access emails. Your app may not have Mail.Read permission.',
                        code: 'EMAIL_ACCESS_DENIED',
                        details: 'Verify that Mail.Read permission is granted with admin consent in your Azure app registration.'
                    };
                }
                
                // Don't fail the entire test if email access fails - user info is sufficient
                console.log('⚠️ Email access failed, but user info was retrieved successfully');
            }
            
            return { 
                success: true, 
                user: {
                    displayName: user.displayName,
                    mail: user.mail,
                    userPrincipalName: user.userPrincipalName
                },
                message: 'Connection successful! Your Azure app registration is properly configured.'
            };
        } catch (error) {
            console.error('Unexpected error in testClientHostedConfig:', error);
            return { 
                success: false, 
                error: `Unexpected error: ${error.message}`,
                code: 'UNEXPECTED_ERROR'
            };
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