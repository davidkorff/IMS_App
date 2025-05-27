# Subdomain-Based Email Architecture Plan

## Overview
Implement a subdomain-based email system where each IMS instance gets a unique subdomain (e.g., `origintest.42consultingllc.com`) and users can create multiple email addresses under that subdomain (e.g., `docs@origintest.42consultingllc.com`, `forms@origintest.42consultingllc.com`).

## Current State (Stable Point)
- Multi-email configuration support implemented
- Email filing list page shows all configurations
- Individual detail pages for each configuration
- Duplicate email processing fixed with message ID checks
- Pricing updated to "Contact 42consulting for pricing"

## Proposed Architecture

### 1. Database Changes

```sql
-- Add subdomain to instances
ALTER TABLE ims_instances 
ADD COLUMN email_subdomain VARCHAR(100) UNIQUE;

-- Add email prefix to configurations (replaces full email address)
ALTER TABLE email_configurations 
ADD COLUMN email_prefix VARCHAR(100);

-- Full email will be: email_prefix@email_subdomain.42consultingllc.com
```

### 2. DNS Configuration (One-time setup)
```
*.42consultingllc.com → MX → documents@42consultingllc.com
```

### 3. Email Flow
1. User sends email to `docs@origintest.42consultingllc.com`
2. Email arrives at `documents@42consultingllc.com` catch-all
3. System parses the `To:` header to extract:
   - Prefix: `docs`
   - Subdomain: `origintest`
4. System finds instance by subdomain
5. System finds email config by prefix
6. Email is processed for that specific configuration

### 4. Implementation Steps

#### Phase 1: Database & Model Updates
- [ ] Add `email_subdomain` to `ims_instances` table
- [ ] Add `email_prefix` to `email_configurations` table
- [ ] Create migration script
- [ ] Update models to handle new fields

#### Phase 2: Email Processing Updates
- [ ] Update `emailProcessor.js` to parse subdomain/prefix from `To:` header
- [ ] Modify `getUnprocessedEmails` to check catch-all inbox
- [ ] Update routing logic to find config by subdomain + prefix
- [ ] Test with various email formats

#### Phase 3: UI Updates
- [ ] Add subdomain selection/generation on instance creation
- [ ] Update email configuration form to show prefix input only
- [ ] Display full generated email address (prefix@subdomain.42consultingllc.com)
- [ ] Add subdomain management to instance settings

#### Phase 4: Validation & Security
- [ ] Subdomain uniqueness validation
- [ ] Reserved subdomain list (www, mail, admin, etc.)
- [ ] Email prefix format validation
- [ ] Prevent cross-instance email processing

### 5. Example User Flow

1. **Instance Creation:**
   - User creates instance "Origin Test Company"
   - System suggests subdomain: `origintest`
   - User confirms or customizes

2. **Email Configuration:**
   - User clicks "Add Email Configuration"
   - Enters prefix: `docs`
   - System shows: "Email address will be: `docs@origintest.42consultingllc.com`"
   - User can create multiple: `forms@`, `quotes@`, `policies@`

3. **Email Usage:**
   - User sends email to `docs@origintest.42consultingllc.com`
   - Email processed and filed to IMS based on configuration

### 6. Benefits
- **Cost Effective**: One email account serves unlimited instances
- **User Friendly**: Intuitive email addresses
- **Scalable**: No limit on email addresses
- **Professional**: Looks like real corporate email structure

### 7. Rollback Plan
If issues arise, we can:
1. Keep existing `email_address` field as fallback
2. Add feature flag to enable/disable subdomain routing
3. Process emails using old method if subdomain parsing fails

### 8. Testing Strategy
1. Create test subdomain entries
2. Send test emails to various subdomain/prefix combinations
3. Verify correct routing and processing
4. Test edge cases (invalid subdomains, missing configs)

## Notes
- Current stable version uses full email addresses
- This plan maintains backward compatibility
- Can be implemented incrementally without breaking existing functionality