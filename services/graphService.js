const { Client } = require('@microsoft/microsoft-graph-client');
const { AuthenticationProvider } = require('@microsoft/microsoft-graph-client');
const axios = require('axios');

class GraphService {
    constructor() {
        this.clientId = process.env.GRAPH_CLIENT_ID;
        this.clientSecret = process.env.GRAPH_CLIENT_SECRET;
        this.tenantId = process.env.GRAPH_TENANT_ID;
        this.redirectUri = process.env.GRAPH_REDIRECT_URI || 'https://ims-application.onrender.com/auth/graph/callback';
        this.webhookUrl = process.env.GRAPH_WEBHOOK_URL || 'https://ims-application.onrender.com/webhooks/graph/email';
        this.emailAddress = 'david@42consultingllc.com';
        
        this.accessToken = null;
        this.tokenExpiry = null;
        
        console.log('GraphService initialized with:');
        console.log('- Client ID:', this.clientId ? `${this.clientId.substring(0, 8)}...` : 'Not set');
        console.log('- Client Secret:', this.clientSecret ? 'Set (hidden)' : 'Not set');
        console.log('- Tenant ID:', this.tenantId ? `${this.tenantId.substring(0, 8)}...` : 'Not set');
        console.log('- Redirect URI:', this.redirectUri);
        console.log('- Webhook URL:', this.webhookUrl);
        console.log('- Email Address:', this.emailAddress);
    }

    // Get admin consent URL for application permissions
    getAuthUrl() {
        // For application permissions, we need to use the admin consent endpoint directly
        const authUrl = `https://login.microsoftonline.com/${this.tenantId}/adminconsent?` +
            `client_id=${this.clientId}&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}`;

        return authUrl;
    }

    // Exchange authorization code for access token
    async getAccessToken(authCode = null) {
        try {
            console.log('=== GETTING ACCESS TOKEN ===');
            
            if (authCode) {
                // Initial token request with authorization code
                console.log('Using authorization code to get initial token');
                return await this.getTokenFromCode(authCode);
            } else {
                // Use client credentials flow for service-to-service
                console.log('Using client credentials flow');
                return await this.getTokenFromClientCredentials();
            }
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    // Get token using client credentials (for service apps)
    async getTokenFromClientCredentials() {
        const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
        
        const params = new URLSearchParams();
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);
        params.append('scope', 'https://graph.microsoft.com/.default');
        params.append('grant_type', 'client_credentials');

        console.log('Token request URL:', tokenUrl);
        console.log('Token request params:', params.toString());

        const response = await axios.post(tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('Token response:', response.data);
        
        if (!response.data.access_token) {
            throw new Error('No access token in response: ' + JSON.stringify(response.data));
        }

        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        
        console.log('Access token obtained, expires at:', new Date(this.tokenExpiry));
        return this.accessToken;
    }

    // Get token from authorization code (for initial setup)
    async getTokenFromCode(authCode) {
        const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
        
        const params = new URLSearchParams();
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);
        params.append('code', authCode);
        params.append('redirect_uri', this.redirectUri);
        params.append('grant_type', 'authorization_code');

        const response = await axios.post(tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        
        return response.data;
    }

    // Ensure we have a valid access token
    async ensureToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry - 60000) { // Refresh 1 min before expiry
            console.log('Token expired or missing, getting new token');
            await this.getAccessToken();
        }
        return this.accessToken;
    }

    // Get Graph API client with authentication
    async getGraphClient() {
        await this.ensureToken();
        
        const authProvider = {
            getAccessToken: async () => {
                await this.ensureToken();
                return this.accessToken;
            }
        };

        return Client.initWithMiddleware({ authProvider });
    }

    // Test connection to Graph API
    async testConnection() {
        try {
            console.log('=== TESTING GRAPH API CONNECTION ===');
            
            await this.ensureToken();
            console.log('✅ Access token obtained successfully');
            
            const client = await this.getGraphClient();
            
            // Test basic API access
            console.log(`Testing access to user: ${this.emailAddress}`);
            const user = await client.api(`/users/${this.emailAddress}`).get();
            console.log('✅ Successfully connected to Graph API');
            console.log('User info:', {
                displayName: user.displayName,
                mail: user.mail,
                userPrincipalName: user.userPrincipalName
            });
            
            return { success: true, user };
        } catch (error) {
            console.error('❌ Graph API connection test failed:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseData: error.response?.data
            });
            
            return { 
                success: false, 
                error: error.message,
                details: {
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText
                }
            };
        }
    }

    // Get emails since a specific timestamp (for incremental processing)
    async getEmailsSinceTimestamp(sinceTimestamp) {
        try {
            // Ensure timestamp is in ISO format for Graph API
            if (sinceTimestamp instanceof Date) {
                sinceTimestamp = sinceTimestamp.toISOString();
            } else if (typeof sinceTimestamp === 'string' && !sinceTimestamp.includes('T')) {
                sinceTimestamp = new Date(sinceTimestamp).toISOString();
            }
            
            console.log(`=== GETTING EMAILS SINCE ${sinceTimestamp} ===`);
            
            const client = await this.getGraphClient();
            
            // Extract base email from plus address if needed
            let mailboxEmail = this.emailAddress;
            const targetEmailAddress = this.emailAddress; // Store original for filtering
            const plusAddressRegex = /^(documents)\+[^@]+(@42consultingllc\.com)$/i;
            const plusMatch = this.emailAddress.match(plusAddressRegex);
            
            if (plusMatch) {
                // Use base email for mailbox access
                mailboxEmail = plusMatch[1] + plusMatch[2];
                console.log(`Using base mailbox: ${mailboxEmail} (from plus address: ${targetEmailAddress})`);
            }
            
            // Get ALL emails newer than timestamp (no TO/CC filtering)
            const messages = await client
                .api(`/users/${mailboxEmail}/messages`)
                .filter(`receivedDateTime gt ${sinceTimestamp}`)
                .top(100) // Get up to 100 new emails
                .select('id,subject,from,receivedDateTime,hasAttachments,toRecipients,ccRecipients,bccRecipients,internetMessageHeaders')
                .orderby('receivedDateTime desc')
                .get();

            console.log(`Retrieved ${messages.value.length} emails newer than ${sinceTimestamp}`);
            
            // If using plus addressing, filter for emails sent to the plus address
            let filteredMessages = messages.value;
            if (plusMatch) {
                filteredMessages = messages.value.filter(msg => {
                    // Check if the plus address is in TO or CC recipients
                    const checkRecipients = (recipients) => {
                        if (!recipients) return false;
                        return recipients.some(r => 
                            r.emailAddress && 
                            r.emailAddress.address && 
                            r.emailAddress.address.toLowerCase() === targetEmailAddress.toLowerCase()
                        );
                    };
                    
                    return checkRecipients(msg.toRecipients) || checkRecipients(msg.ccRecipients);
                });
                console.log(`Filtered to ${filteredMessages.length} emails sent to ${targetEmailAddress}`);
            }
            
            // Return filtered emails
            return filteredMessages.map(msg => ({
                id: msg.id,
                subject: msg.subject,
                from: msg.from ? msg.from.emailAddress.address : 'Unknown',
                receivedDateTime: msg.receivedDateTime,
                hasAttachments: msg.hasAttachments
            }));
        } catch (error) {
            console.error('Error getting emails since timestamp:', error);
            throw error;
        }
    }

    // Get recent emails (for testing - legacy method)
    async getRecentEmails(count = 5) {
        try {
            console.log(`=== GETTING ${count} RECENT EMAILS ===`);
            
            const client = await this.getGraphClient();
            
            // Extract base email from plus address if needed
            let mailboxEmail = this.emailAddress;
            const plusAddressRegex = /^(documents)\+[^@]+(@42consultingllc\.com)$/i;
            const plusMatch = this.emailAddress.match(plusAddressRegex);
            
            if (plusMatch) {
                // Use base email for mailbox access
                mailboxEmail = plusMatch[1] + plusMatch[2];
                console.log(`Using base mailbox: ${mailboxEmail} (from plus address: ${this.emailAddress})`);
            }
            
            // Get ALL recent emails (no TO/CC filtering)
            const messages = await client
                .api(`/users/${mailboxEmail}/messages`)
                .top(count)
                .select('id,subject,from,receivedDateTime,hasAttachments')
                .orderby('receivedDateTime desc')
                .get();

            console.log(`Retrieved ${messages.value.length} recent emails`);
            
            return messages.value.map(msg => ({
                id: msg.id,
                subject: msg.subject,
                from: msg.from ? msg.from.emailAddress.address : 'Unknown',
                receivedDateTime: msg.receivedDateTime,
                hasAttachments: msg.hasAttachments
            }));
        } catch (error) {
            console.error('Error getting recent emails:', error);
            throw error;
        }
    }

    // Get email with full content and attachments
    async getEmailWithAttachments(messageId) {
        try {
            console.log(`=== GETTING EMAIL ${messageId} WITH ATTACHMENTS ===`);
            
            const client = await this.getGraphClient();
            
            // Extract base email from plus address if needed
            let mailboxEmail = this.emailAddress;
            const plusAddressRegex = /^(documents)\+[^@]+(@42consultingllc\.com)$/i;
            const plusMatch = this.emailAddress.match(plusAddressRegex);
            
            if (plusMatch) {
                // Use base email for mailbox access
                mailboxEmail = plusMatch[1] + plusMatch[2];
                console.log(`Using base mailbox: ${mailboxEmail} (from plus address: ${this.emailAddress})`);
            }
            
            // Get the email message
            const message = await client
                .api(`/users/${mailboxEmail}/messages/${messageId}`)
                .expand('attachments')
                .get();

            console.log('Email details:', {
                subject: message.subject,
                from: message.from ? message.from.emailAddress.address : 'Unknown',
                hasAttachments: message.hasAttachments,
                attachmentCount: message.attachments ? message.attachments.length : 0
            });

            // Process attachments if any
            const processedAttachments = [];
            if (message.attachments && message.attachments.length > 0) {
                for (const attachment of message.attachments) {
                    console.log(`Processing attachment: ${attachment.name} (${attachment.size} bytes)`);
                    
                    try {
                        // Get attachment content as stream
                        const attachmentStream = await client
                            .api(`/users/${mailboxEmail}/messages/${messageId}/attachments/${attachment.id}/$value`)
                            .get();

                        // Convert stream to buffer
                        let attachmentBuffer;
                        if (attachmentStream instanceof ReadableStream) {
                            // Handle ReadableStream
                            const reader = attachmentStream.getReader();
                            const chunks = [];
                            let done = false;
                            
                            while (!done) {
                                const { value, done: streamDone } = await reader.read();
                                done = streamDone;
                                if (value) {
                                    chunks.push(value);
                                }
                            }
                            
                            attachmentBuffer = Buffer.concat(chunks);
                        } else if (Buffer.isBuffer(attachmentStream)) {
                            // Already a buffer
                            attachmentBuffer = attachmentStream;
                        } else if (typeof attachmentStream === 'string') {
                            // String data
                            attachmentBuffer = Buffer.from(attachmentStream);
                        } else {
                            // Try to convert to buffer
                            attachmentBuffer = Buffer.from(attachmentStream);
                        }

                        processedAttachments.push({
                            name: attachment.name,
                            contentType: attachment.contentType,
                            size: attachment.size,
                            data: attachmentBuffer.toString('base64')
                        });
                        
                        console.log(`Successfully processed attachment: ${attachment.name}`);
                    } catch (attachmentError) {
                        console.error(`Error processing attachment ${attachment.name}:`, attachmentError);
                        processedAttachments.push({
                            name: attachment.name,
                            contentType: attachment.contentType,
                            size: attachment.size,
                            error: `Failed to download: ${attachmentError.message}`
                        });
                    }
                }
            }

            return {
                id: message.id,
                subject: message.subject,
                from: message.from ? message.from.emailAddress.address : null,
                to: message.toRecipients ? message.toRecipients.map(r => r.emailAddress.address) : [],
                receivedDateTime: message.receivedDateTime,
                bodyContent: message.body ? message.body.content : '',
                bodyContentType: message.body ? message.body.contentType : 'text',
                hasAttachments: message.hasAttachments,
                attachments: processedAttachments
            };
        } catch (error) {
            console.error(`Error getting email ${messageId}:`, error);
            throw error;
        }
    }
}

module.exports = new GraphService();