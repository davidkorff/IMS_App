const pool = require('../config/db');

class ForwardedEmailParser {
    constructor() {
        this.domain = '42consultingllc.com';
    }

    /**
     * Parse the original recipient from a forwarded email
     * Works with Cloudflare Email Routing which preserves headers
     */
    async parseOriginalRecipient(message) {
        // Check all To recipients
        if (message.toRecipients && message.toRecipients.length > 0) {
            for (const recipient of message.toRecipients) {
                const email = recipient.emailAddress.address.toLowerCase();
                
                // Check if it matches our subdomain pattern: prefix@subdomain.domain
                const subdomainMatch = email.match(/^([a-z0-9._-]+)@([a-z0-9-]+)\.42consultingllc\.com$/);
                if (subdomainMatch) {
                    return {
                        type: 'subdomain',
                        prefix: subdomainMatch[1],
                        subdomain: subdomainMatch[2],
                        fullEmail: email
                    };
                }
                
                // Check for plus addressing pattern (for backward compatibility)
                const plusMatch = email.match(/^documents\+([^@]+)@42consultingllc\.com$/);
                if (plusMatch) {
                    return {
                        type: 'plus',
                        suffix: plusMatch[1],
                        fullEmail: email
                    };
                }
            }
        }

        // Check CC recipients as fallback
        if (message.ccRecipients && message.ccRecipients.length > 0) {
            for (const recipient of message.ccRecipients) {
                const email = recipient.emailAddress.address.toLowerCase();
                
                const subdomainMatch = email.match(/^([a-z0-9._-]+)@([a-z0-9-]+)\.42consultingllc\.com$/);
                if (subdomainMatch) {
                    return {
                        type: 'subdomain',
                        prefix: subdomainMatch[1],
                        subdomain: subdomainMatch[2],
                        fullEmail: email,
                        fromCC: true
                    };
                }
            }
        }

        // Check email headers if available (some forwarding services add headers)
        if (message.internetMessageHeaders) {
            const originalToHeader = message.internetMessageHeaders.find(
                h => h.name.toLowerCase() === 'x-original-to' || 
                     h.name.toLowerCase() === 'delivered-to' ||
                     h.name.toLowerCase() === 'envelope-to'
            );
            
            if (originalToHeader) {
                const email = originalToHeader.value.toLowerCase();
                const subdomainMatch = email.match(/^([a-z0-9._-]+)@([a-z0-9-]+)\.42consultingllc\.com$/);
                if (subdomainMatch) {
                    return {
                        type: 'subdomain',
                        prefix: subdomainMatch[1],
                        subdomain: subdomainMatch[2],
                        fullEmail: email,
                        fromHeader: true
                    };
                }
            }
        }

        return null;
    }

    /**
     * Find the email configuration based on parsed recipient
     */
    async findConfigurationByRecipient(parsedRecipient) {
        if (!parsedRecipient) return null;

        try {
            if (parsedRecipient.type === 'subdomain') {
                // Find by subdomain and prefix
                const result = await pool.query(`
                    SELECT 
                        ec.*,
                        ii.instance_id,
                        ii.name as instance_name,
                        ii.url as instance_url,
                        ii.username,
                        ii.password,
                        ii.email_subdomain
                    FROM email_configurations ec
                    JOIN ims_instances ii ON ec.instance_id = ii.instance_id
                    WHERE ii.email_subdomain = $1 
                    AND ec.email_prefix = $2
                    AND ii.email_status = 'active'
                `, [parsedRecipient.subdomain, parsedRecipient.prefix]);

                if (result.rows.length > 0) {
                    return {
                        config: result.rows[0],
                        matchType: 'exact'
                    };
                }

                // Try to find instance by subdomain only (for default prefix)
                const instanceResult = await pool.query(`
                    SELECT 
                        ec.*,
                        ii.instance_id,
                        ii.name as instance_name,
                        ii.url as instance_url,
                        ii.username,
                        ii.password,
                        ii.email_subdomain
                    FROM email_configurations ec
                    JOIN ims_instances ii ON ec.instance_id = ii.instance_id
                    WHERE ii.email_subdomain = $1
                    AND ec.is_default = true
                    AND ii.email_status = 'active'
                `, [parsedRecipient.subdomain]);

                if (instanceResult.rows.length > 0) {
                    return {
                        config: instanceResult.rows[0],
                        matchType: 'default'
                    };
                }
            } else if (parsedRecipient.type === 'plus') {
                // Handle plus addressing for backward compatibility
                const result = await pool.query(`
                    SELECT 
                        ec.*,
                        ii.instance_id,
                        ii.name as instance_name,
                        ii.url as instance_url,
                        ii.username,
                        ii.password
                    FROM email_configurations ec
                    JOIN ims_instances ii ON ec.instance_id = ii.instance_id
                    WHERE ec.email_address = $1
                    AND ii.email_status = 'active'
                `, [parsedRecipient.fullEmail]);

                if (result.rows.length > 0) {
                    return {
                        config: result.rows[0],
                        matchType: 'plus-address'
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Error finding configuration by recipient:', error);
            return null;
        }
    }

    /**
     * Process email based on original recipient
     */
    async routeEmail(message) {
        const parsedRecipient = await this.parseOriginalRecipient(message);
        
        if (!parsedRecipient) {
            console.log('No valid recipient pattern found in email');
            return null;
        }

        console.log('Parsed recipient:', parsedRecipient);

        const configMatch = await this.findConfigurationByRecipient(parsedRecipient);
        
        if (!configMatch) {
            console.log(`No active configuration found for ${parsedRecipient.fullEmail}`);
            return null;
        }

        return {
            ...configMatch,
            parsedRecipient
        };
    }
}

module.exports = new ForwardedEmailParser();