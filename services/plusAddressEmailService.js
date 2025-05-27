const pool = require('../config/db');

class PlusAddressEmailService {
    constructor() {
        this.baseEmail = 'documents@42consultingllc.com';
        this.domain = '42consultingllc.com';
    }

    // Parse plus address to extract subdomain and prefix
    parsePlusAddress(emailAddress) {
        // Match patterns like: documents+{suffix}@42consultingllc.com
        const regex = new RegExp(`^documents\\+([^@]+)@${this.domain.replace('.', '\\.')}$`, 'i');
        const match = emailAddress.match(regex);
        
        if (match) {
            const suffix = match[1];
            
            // For backward compatibility, check if suffix contains subdomain-prefix pattern
            const legacyMatch = suffix.match(/^([^-]+)-(.+)$/);
            if (legacyMatch) {
                return {
                    subdomain: legacyMatch[1].toLowerCase(),
                    prefix: legacyMatch[2].toLowerCase(),
                    suffix: suffix.toLowerCase(),
                    isPlusAddress: true
                };
            }
            
            // New format: just the custom suffix
            return {
                suffix: suffix.toLowerCase(),
                isPlusAddress: true
            };
        }
        
        // Check if it's the base email without plus
        if (emailAddress.toLowerCase() === this.baseEmail.toLowerCase()) {
            return {
                isPlusAddress: false,
                isBaseEmail: true
            };
        }
        
        // Not a plus address we recognize
        return {
            isPlusAddress: false,
            originalEmail: emailAddress
        };
    }

    // Generate plus address from subdomain and prefix
    generatePlusAddress(subdomain, prefix) {
        return `documents+${subdomain}-${prefix}@${this.domain}`;
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
    async routeEmail(toAddresses) {
        // toAddresses might be an array or string
        const addresses = Array.isArray(toAddresses) ? toAddresses : [toAddresses];
        
        // Check each address to find a plus address
        for (const address of addresses) {
            if (!address) continue;
            
            const parsed = this.parsePlusAddress(address);
            
            if (parsed.isPlusAddress) {
                // Handle new format with just suffix
                if (parsed.suffix && !parsed.subdomain) {
                    // Find config by exact email address
                    const configResult = await pool.query(`
                        SELECT ec.*, ii.* 
                        FROM email_configurations ec
                        JOIN ims_instances ii ON ec.instance_id = ii.instance_id
                        WHERE ec.email_address = $1
                    `, [address]);
                    
                    if (configResult.rows.length > 0) {
                        const row = configResult.rows[0];
                        return {
                            instance: {
                                instance_id: row.instance_id,
                                name: row.name,
                                url: row.url,
                                email_subdomain: row.email_subdomain
                            },
                            config: {
                                id: row.id,
                                email_address: row.email_address,
                                email_prefix: row.email_prefix,
                                default_folder_id: row.default_folder_id,
                                control_number_patterns: row.control_number_patterns
                            },
                            routingType: 'plus-address-custom',
                            suffix: parsed.suffix
                        };
                    }
                }
                
                // Handle legacy format with subdomain-prefix
                if (parsed.subdomain && parsed.prefix) {
                    // Find instance by subdomain
                    const instance = await this.findInstanceBySubdomain(parsed.subdomain);
                    if (!instance) {
                        console.log(`No instance found for subdomain: ${parsed.subdomain}`);
                        continue;
                    }
                    
                    // Find config by prefix
                    const config = await this.findConfigByPrefix(instance.instance_id, parsed.prefix);
                    if (!config) {
                        console.log(`No config found for prefix: ${parsed.prefix} in instance ${instance.instance_id}`);
                        continue;
                    }
                    
                    return {
                        instance,
                        config,
                        routingType: 'plus-address-legacy',
                        subdomain: parsed.subdomain,
                        prefix: parsed.prefix
                    };
                }
            }
        }
        
        // If no plus address found, try legacy routing
        return await this.routeLegacyEmail(addresses[0]);
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

    // Generate subdomain from instance name (same as before)
    generateSubdomain(instanceName) {
        let subdomain = instanceName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        if (!/^[a-z0-9]/.test(subdomain)) {
            subdomain = 'inst-' + subdomain;
        }
        
        if (subdomain.length > 20) {
            subdomain = subdomain.substring(0, 20);
        }
        
        return subdomain;
    }

    // Check if subdomain is available
    async isSubdomainAvailable(subdomain) {
        try {
            const reserved = await pool.query(
                'SELECT 1 FROM reserved_subdomains WHERE subdomain = $1',
                [subdomain.toLowerCase()]
            );
            
            if (reserved.rows.length > 0) {
                return { available: false, reason: 'Reserved subdomain' };
            }
            
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
        // Must be 1-20 chars, alphanumeric only for plus addressing
        const regex = /^[a-z0-9]{1,20}$/;
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

module.exports = PlusAddressEmailService;