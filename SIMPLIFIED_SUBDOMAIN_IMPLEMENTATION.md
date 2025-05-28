# Simplified Subdomain Email Implementation

## Architecture Overview

### Email Flow
1. User sends email to: `docs@isctest.42consultingllc.com`
2. Cloudflare forwards to: `catches-all@42consultingllc.com`
3. Every 5 minutes, cron job processes ALL emails from catch-all inbox
4. Routes each email to correct instance/config based on TO header

## Database Structure

### Instance Level
```sql
ims_instances:
- instance_id
- name: "ISC Test"
- email_subdomain: "isctest"  -- lowercase, no spaces
```

### Email Configuration Level
```sql
email_configurations:
- id
- instance_id: 1
- email_prefix: "docs"
- full_email: "docs@isctest.42consultingllc.com"  -- computed
```

## Implementation Steps

### 1. Update Email Processor (emailProcessor.js)

```javascript
class EmailProcessor {
    // Single catch-all inbox for all instances
    CATCH_ALL_INBOX = 'catches-all@42consultingllc.com';
    
    async processAllInstances() {
        console.log('=== PROCESSING CATCH-ALL INBOX ===');
        
        // 1. Get ALL new emails from catch-all (single API call)
        const lastProcessed = await this.getLastProcessedTimestamp();
        const allEmails = await graphService.getEmailsSince(
            this.CATCH_ALL_INBOX, 
            lastProcessed
        );
        
        console.log(`Found ${allEmails.length} new emails to process`);
        
        // 2. Group emails by subdomain/prefix
        const groupedEmails = await this.groupEmailsByConfig(allEmails);
        
        // 3. Process each group
        for (const [configKey, emails] of groupedEmails) {
            await this.processConfigEmails(configKey, emails);
        }
        
        // 4. Update global last processed timestamp
        await this.updateLastProcessedTimestamp(new Date());
    }
    
    async groupEmailsByConfig(emails) {
        const grouped = new Map();
        
        for (const email of emails) {
            // Parse TO recipients to find our subdomain pattern
            const recipient = this.parseSubdomainRecipient(email);
            
            if (!recipient) {
                console.log(`No valid recipient found for email: ${email.subject}`);
                continue;
            }
            
            // Find matching configuration
            const config = await this.findConfigBySubdomainPrefix(
                recipient.subdomain, 
                recipient.prefix
            );
            
            if (!config) {
                console.log(`No config found for ${recipient.fullEmail}`);
                continue;
            }
            
            const key = `${config.instance_id}-${config.id}`;
            if (!grouped.has(key)) {
                grouped.set(key, { config, emails: [] });
            }
            grouped.get(key).emails.push(email);
        }
        
        return grouped;
    }
    
    parseSubdomainRecipient(email) {
        // Check TO recipients for pattern: prefix@subdomain.42consultingllc.com
        for (const recipient of email.toRecipients || []) {
            const match = recipient.emailAddress.address.match(
                /^([a-z0-9-]+)@([a-z0-9-]+)\.42consultingllc\.com$/i
            );
            
            if (match) {
                return {
                    prefix: match[1].toLowerCase(),
                    subdomain: match[2].toLowerCase(),
                    fullEmail: recipient.emailAddress.address.toLowerCase()
                };
            }
        }
        return null;
    }
}
```

### 2. Simplified Database Queries

```javascript
// Cache configurations for performance
let configCache = null;
let cacheExpiry = null;

async function loadAllConfigurations() {
    if (configCache && cacheExpiry > Date.now()) {
        return configCache;
    }
    
    const result = await pool.query(`
        SELECT 
            ec.id,
            ec.instance_id,
            ec.email_prefix,
            ec.control_number_patterns,
            ec.default_folder_id,
            ii.email_subdomain,
            ii.name as instance_name,
            ii.url,
            ii.username,
            ii.password
        FROM email_configurations ec
        JOIN ims_instances ii ON ec.instance_id = ii.instance_id
        WHERE ii.email_status = 'active'
    `);
    
    // Build lookup map
    configCache = new Map();
    for (const row of result.rows) {
        const key = `${row.email_subdomain}-${row.email_prefix}`;
        configCache.set(key, row);
    }
    
    cacheExpiry = Date.now() + 60000; // Cache for 1 minute
    return configCache;
}
```

### 3. Manual Processing Endpoint

```javascript
// Process specific instance on-demand
router.post('/process/:instanceId', async (req, res) => {
    const { instanceId } = req.params;
    
    // Get instance subdomain
    const instance = await getInstanceById(instanceId);
    if (!instance.email_subdomain) {
        return res.status(400).json({ error: 'No subdomain configured' });
    }
    
    // Get recent emails from catch-all
    const recentEmails = await graphService.getRecentEmails(
        'catches-all@42consultingllc.com',
        50 // Last 50 emails
    );
    
    // Filter for this instance's emails
    const instanceEmails = recentEmails.filter(email => {
        const recipient = parseSubdomainRecipient(email);
        return recipient?.subdomain === instance.email_subdomain;
    });
    
    // Process immediately
    await processInstanceEmails(instance, instanceEmails);
    
    res.json({ 
        success: true, 
        processed: instanceEmails.length 
    });
});
```

### 4. Cron Job Setup

```javascript
// server.js
const CronJob = require('node-cron');

// Run every 5 minutes
const emailCron = cron.schedule('*/5 * * * *', async () => {
    console.log('Starting scheduled email processing...');
    try {
        await emailProcessor.processAllInstances();
    } catch (error) {
        console.error('Email processing error:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    emailCron.stop();
});
```

## Benefits of This Approach

### 1. **Performance**
- Single API call gets ALL emails
- Batch processing is more efficient
- Caching reduces database queries

### 2. **Scalability**
- Adding new instances doesn't increase API calls
- Can process 1000s of emails efficiently
- Easy to add parallel processing later

### 3. **Simplicity**
- One inbox to monitor
- One cron job
- Clear routing logic

### 4. **Reliability**
- If an instance is down, emails still collected
- Can reprocess failed emails
- Single point of monitoring

## Migration Plan

### Phase 1: Setup (1 day)
1. Create `catches-all@42consultingllc.com` mailbox
2. Configure Cloudflare email routing
3. Test header preservation

### Phase 2: Code Updates (2-3 days)
1. Remove plus addressing code
2. Implement catch-all processor
3. Update email configuration creation
4. Add cron job

### Phase 3: Testing (2 days)
1. Test with single instance
2. Test with multiple instances
3. Performance testing
4. Error handling

### Phase 4: Migration (1 day)
1. Update all instances to use subdomains
2. Update email configurations
3. Enable cron job
4. Monitor for issues

## Total Implementation: ~1 week

This is much simpler than supporting both systems!