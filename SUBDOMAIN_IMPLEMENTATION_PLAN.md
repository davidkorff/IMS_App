# Subdomain Email Implementation Plan

## Executive Summary
Implementing subdomain-based email routing (`docs@isctest.42consultingllc.com`) requires significant changes to email processing logic while maintaining backward compatibility with plus addressing.

## Current vs. Target Architecture

### Current (Plus Addressing)
```
Email sent to: documents+origintest@42consultingllc.com
Mailbox accessed: documents@42consultingllc.com
Filtering: By TO/CC recipients matching plus address
```

### Target (Subdomain Routing)
```
Email sent to: docs@isctest.42consultingllc.com
Forwarded to: documents@42consultingllc.com (catch-all)
Routing: Parse original recipient from headers
```

## Implementation Phases

### Phase 1: Email Forwarding Setup (External)
1. **Cloudflare Email Routing Configuration**
   ```
   Rule: *@*.42consultingllc.com → documents@42consultingllc.com
   ```
2. **Test header preservation**
   - Verify TO headers contain original address
   - Check for X-Original-To or Delivered-To headers

### Phase 2: Update Email Processing Logic

#### 2.1 Modify Email Retrieval
```javascript
// emailProcessor.js - getUnprocessedEmails
async getUnprocessedEmails(config) {
    // For subdomain configs, get ALL catch-all emails
    if (config.email_system_type === 'subdomain') {
        const catchAllAddress = 'documents@42consultingllc.com';
        // Get all emails from catch-all
        const allEmails = await this.getAllCatchAllEmails(catchAllAddress, config.last_processed_timestamp);
        
        // Filter by subdomain pattern
        return this.filterEmailsBySubdomain(allEmails, config);
    } else {
        // Existing plus addressing logic
        return this.getEmailsWithClientCredentialsSinceTimestamp(config, lastProcessed);
    }
}
```

#### 2.2 Add Subdomain Filtering
```javascript
async filterEmailsBySubdomain(emails, config) {
    const filtered = [];
    const targetPattern = new RegExp(
        `^${config.email_prefix}@${config.instance.email_subdomain}\\.42consultingllc\\.com$`,
        'i'
    );
    
    for (const email of emails) {
        // Check TO recipients
        const hasMatchingRecipient = email.toRecipients?.some(r => 
            targetPattern.test(r.emailAddress.address)
        );
        
        if (hasMatchingRecipient) {
            filtered.push(email);
        }
    }
    
    return filtered;
}
```

#### 2.3 Update Graph API Calls
```javascript
// For catch-all, always use base mailbox
const mailboxToAccess = config.email_system_type === 'subdomain' 
    ? 'documents@42consultingllc.com' 
    : this.extractBaseMailbox(config.email_address);
```

### Phase 3: Database Updates

#### 3.1 Add Configuration Flag
```sql
ALTER TABLE email_configurations 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Mark default configs for each subdomain
UPDATE email_configurations 
SET is_default = true 
WHERE id IN (
    SELECT DISTINCT ON (instance_id) id 
    FROM email_configurations 
    ORDER BY instance_id, created_at ASC
);
```

#### 3.2 Update Email System Type
```sql
-- Migrate specific instances to subdomain system
UPDATE email_configurations 
SET email_system_type = 'subdomain',
    email_address = email_prefix || '@' || 
                   (SELECT email_subdomain FROM ims_instances WHERE instance_id = email_configurations.instance_id) || 
                   '.42consultingllc.com'
WHERE instance_id IN (/* test instances */);
```

### Phase 4: UI Updates

#### 4.1 Email Configuration Creation
- Keep showing subdomain format in preview
- Store as subdomain type in database
- Remove plus address generation

#### 4.2 Configuration Display
- Show actual subdomain email address
- Add indicator for routing type
- Display catch-all status

### Phase 5: Testing Strategy

#### 5.1 Test Scenarios
1. **Single subdomain, single prefix**
   - Send to: `docs@test1.42consultingllc.com`
   - Verify routing to test1 instance

2. **Single subdomain, multiple prefixes**
   - Send to: `docs@test1.42consultingllc.com`
   - Send to: `invoices@test1.42consultingllc.com`
   - Verify correct configuration routing

3. **Multiple subdomains**
   - Send to: `docs@test1.42consultingllc.com`
   - Send to: `docs@test2.42consultingllc.com`
   - Verify isolation between instances

4. **Mixed system (backward compatibility)**
   - Subdomain: `docs@test1.42consultingllc.com`
   - Plus address: `documents+test2@42consultingllc.com`
   - Verify both work simultaneously

#### 5.2 Performance Testing
- Send 100 emails to different subdomains
- Measure processing time
- Monitor catch-all inbox size

### Phase 6: Rollout Plan

1. **Enable for new instances only**
   - New instances use subdomain by default
   - Existing instances keep plus addressing

2. **Gradual migration**
   - Migrate test instances first
   - Monitor for issues
   - Migrate production instances in batches

3. **Dual-mode operation**
   - Support both systems simultaneously
   - No forced migration
   - Clear documentation for both approaches

## Risk Mitigation

### 1. **Header Modification Risk**
- **Risk**: Email forwarding service modifies headers
- **Mitigation**: 
  - Test multiple header fields (TO, CC, X-Original-To)
  - Store multiple routing patterns
  - Fallback to email body parsing if needed

### 2. **Performance Risk**
- **Risk**: Processing all catch-all emails is slow
- **Mitigation**:
  - Implement efficient filtering
  - Add caching for subdomain lookups
  - Process in batches with pagination

### 3. **Configuration Complexity**
- **Risk**: Users confused by two email systems
- **Mitigation**:
  - Clear UI indicators
  - Comprehensive documentation
  - Automatic system selection for new instances

## Code Changes Summary

### Files to Modify:
1. `services/emailProcessor.js`
   - Add subdomain filtering logic
   - Update email retrieval for catch-all
   - Modify routing decisions

2. `services/subdomainEmailService.js`
   - Integrate into main processing flow
   - Add efficient subdomain matching
   - Cache subdomain configurations

3. `routes/emailConfig.js`
   - Update creation endpoints
   - Set correct email_system_type
   - Generate proper email addresses

4. `public/email-filing-new.html`
   - Update email preview logic
   - Remove plus address generation
   - Add system type indicator

5. `services/graphService.js`
   - Always use catch-all for subdomain configs
   - Preserve header information
   - Handle pagination for large inboxes

## Success Criteria

1. **Functional Requirements**
   - Emails to subdomain addresses are correctly routed
   - Plus addressing continues to work
   - No emails are lost or misrouted

2. **Performance Requirements**
   - Email processing time < 2x current time
   - Support 1000+ emails/hour
   - Efficient subdomain matching

3. **User Experience**
   - Clear configuration process
   - Obvious email address format
   - Smooth migration path

## Timeline Estimate

- Phase 1 (External setup): 1 day
- Phase 2 (Processing logic): 3-4 days
- Phase 3 (Database): 1 day
- Phase 4 (UI): 1-2 days
- Phase 5 (Testing): 2-3 days
- Phase 6 (Rollout): 1-2 weeks

**Total: 2-3 weeks for full implementation**