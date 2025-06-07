const pool = require('../config/db');

class SubdomainEmailService {
    constructor() {
        this.baseDomain = '42consultingllc.com';
        this.catchAllEmail = 'documents@42consultingllc.com';
    }

    // Parse email address to extract subdomain and prefix
    parseEmailAddress(emailAddress) {
        // Pattern 1: CNAME-based emails like docs@cname.42ims.com
        const cnameRegex = /^([^@]+)@([^.]+)\.42ims\.com$/i;
        const cnameMatch = emailAddress.match(cnameRegex);
        
        if (cnameMatch) {
            return {
                prefix: cnameMatch[1].toLowerCase(),
                customDomain: cnameMatch[2].toLowerCase(),
                isSubdomainEmail: true,
                isCustomDomain: true,
                emailType: 'cname'
            };
        }
        
        // Pattern 2: Standard subdomain emails like docs@subdomain.42consultingllc.com
        const subdomainRegex = new RegExp(`^([^@]+)@([^.]+)\\.${this.baseDomain.replace('.', '\\.')}$`, 'i');
        const subdomainMatch = emailAddress.match(subdomainRegex);
        
        if (subdomainMatch) {
            return {
                prefix: subdomainMatch[1].toLowerCase(),
                subdomain: subdomainMatch[2].toLowerCase(),
                isSubdomainEmail: true,
                isCustomDomain: false,
                emailType: 'subdomain'
            };
        }
        
        // Pattern 3: Legacy hyphenated emails like docs-subdomain@42ims.com
        const legacyRegex = /^([^-@]+)-([^@]+)@42ims\.com$/i;
        const legacyMatch = emailAddress.match(legacyRegex);
        
        if (legacyMatch) {
            return {
                prefix: legacyMatch[1].toLowerCase(),
                subdomain: legacyMatch[2].toLowerCase(),
                isSubdomainEmail: true,
                isCustomDomain: false,
                emailType: 'legacy'
            };
        }
        
        // Not a recognized subdomain email
        return {
            isSubdomainEmail: false,
            originalEmail: emailAddress
        };
    }

    // Generate full email address from prefix and subdomain
    generateEmailAddress(prefix, subdomain) {
        return `${prefix}@${subdomain}.${this.baseDomain}`;
    }

    // Find instance by subdomain
    async findInstanceBySubdomain(subdomain) {
        try {
            const result = await pool.query(
                'SELECT * FROM ims_instances WHERE email_subdomain = $1',
                [subdomain.toLowerCase()]
            );
            
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding instance by subdomain:', error);
            return null;
        }
    }

    // Find instance by custom domain (CNAME)
    async findInstanceByCustomDomain(customDomain) {
        try {
            const result = await pool.query(
                'SELECT * FROM ims_instances WHERE custom_domain = $1',
                [customDomain.toLowerCase()]
            );
            
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding instance by custom domain:', error);
            return null;
        }
    }

    // Find email configuration by instance and prefix
    async findConfigByPrefix(instanceId, prefix) {
        try {
            const result = await pool.query(`
                SELECT * FROM email_configurations 
                WHERE instance_id = $1 
                AND email_prefix = $2 
                AND email_system_type = 'subdomain'
            `, [instanceId, prefix.toLowerCase()]);
            
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding config by prefix:', error);
            return null;
        }
    }

    // Route email to correct configuration
    async routeEmail(toAddress) {
        const parsed = this.parseEmailAddress(toAddress);
        
        if (!parsed.isSubdomainEmail) {
            // Fall back to legacy routing
            return await this.routeLegacyEmail(toAddress);
        }
        
        // Find instance based on email type
        let instance = null;
        let routingType = parsed.emailType;
        
        if (parsed.isCustomDomain) {
            // CNAME-based email: docs@cname.42ims.com
            instance = await this.findInstanceByCustomDomain(parsed.customDomain);
            if (!instance) {
                console.log(`No instance found for custom domain: ${parsed.customDomain}`);
                return null;
            }
        } else {
            // Subdomain-based email: docs@subdomain.42consultingllc.com or docs-subdomain@42ims.com
            instance = await this.findInstanceBySubdomain(parsed.subdomain);
            if (!instance) {
                console.log(`No instance found for subdomain: ${parsed.subdomain}`);
                return null;
            }
        }
        
        // Find config by prefix
        const config = await this.findConfigByPrefix(instance.instance_id, parsed.prefix);
        if (!config) {
            console.log(`No config found for prefix: ${parsed.prefix} in instance ${instance.instance_id}`);
            return null;
        }
        
        return {
            instance,
            config,
            routingType,
            subdomain: parsed.subdomain,
            customDomain: parsed.customDomain,
            prefix: parsed.prefix,
            emailType: parsed.emailType
        };
    }

    // Route legacy email (backward compatibility)
    async routeLegacyEmail(emailAddress) {
        try {
            const result = await pool.query(`
                SELECT 
                    ec.*,
                    ii.instance_id,
                    ii.name as instance_name,
                    ii.url,
                    ii.username,
                    ii.password
                FROM email_configurations ec
                JOIN ims_instances ii ON ec.instance_id = ii.instance_id
                WHERE ec.email_address = $1
                AND ec.email_system_type = 'legacy'
            `, [emailAddress]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const row = result.rows[0];
            return {
                instance: {
                    instance_id: row.instance_id,
                    name: row.instance_name,
                    url: row.url,
                    username: row.username,
                    password: row.password
                },
                config: row,
                routingType: 'legacy'
            };
        } catch (error) {
            console.error('Error routing legacy email:', error);
            return null;
        }
    }

    // Generate subdomain from instance name
    generateSubdomain(instanceName) {
        // Remove special characters, convert to lowercase, replace spaces with hyphens
        let subdomain = instanceName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        // Ensure it starts with a letter or number
        if (!/^[a-z0-9]/.test(subdomain)) {
            subdomain = 'inst-' + subdomain;
        }
        
        // Limit length
        if (subdomain.length > 63) {
            subdomain = subdomain.substring(0, 63);
        }
        
        return subdomain;
    }

    // Check if subdomain is available
    async isSubdomainAvailable(subdomain) {
        try {
            // Check reserved subdomains
            const reserved = await pool.query(
                'SELECT 1 FROM reserved_subdomains WHERE subdomain = $1',
                [subdomain.toLowerCase()]
            );
            
            if (reserved.rows.length > 0) {
                return { available: false, reason: 'Reserved subdomain' };
            }
            
            // Check existing instances
            const existing = await pool.query(
                'SELECT 1 FROM ims_instances WHERE email_subdomain = $1',
                [subdomain.toLowerCase()]
            );
            
            if (existing.rows.length > 0) {
                return { available: false, reason: 'Subdomain already in use' };
            }
            
            return { available: true };
        } catch (error) {
            console.error('Error checking subdomain availability:', error);
            return { available: false, reason: 'Error checking availability' };
        }
    }

    // Validate email prefix
    validatePrefix(prefix) {
        // Must be 1-64 chars, start/end with alphanumeric, can contain dots, hyphens, underscores
        const regex = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/;
        return regex.test(prefix.toLowerCase());
    }

    // Check if prefix is available for instance
    async isPrefixAvailable(instanceId, prefix) {
        try {
            const result = await pool.query(
                'SELECT 1 FROM email_configurations WHERE instance_id = $1 AND email_prefix = $2',
                [instanceId, prefix.toLowerCase()]
            );
            
            return result.rows.length === 0;
        } catch (error) {
            console.error('Error checking prefix availability:', error);
            return false;
        }
    }
}

module.exports = new SubdomainEmailService();