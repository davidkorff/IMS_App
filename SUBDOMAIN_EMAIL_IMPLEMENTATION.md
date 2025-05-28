# Subdomain Email Implementation Guide

## Overview
This guide explains how to implement subdomain-based email routing (`docs@isctest.42consultingllc.com`) without requiring Office 365 wildcard domain support.

## Architecture

### Option 1: Cloudflare Email Routing (Recommended)
Free and works seamlessly with Office 365.

#### Setup Steps:
1. **Add domain to Cloudflare**
   - Add `42consultingllc.com` to Cloudflare
   - Update nameservers at your registrar

2. **Configure Email Routing**
   - Enable Email Routing in Cloudflare dashboard
   - Create catch-all rule:
     ```
     Destination: *@*.42consultingllc.com
     Action: Forward to → documents@42consultingllc.com
     ```

3. **Preserve Original Headers**
   - Cloudflare preserves the original `To:` header
   - Your app reads from `documents@42consultingllc.com`
   - Parse the original recipient from headers

### Option 2: SendGrid Inbound Parse
Receives emails via webhook instead of mailbox polling.

#### Setup Steps:
1. **Configure MX records**
   ```
   *.42consultingllc.com → mx.sendgrid.net (priority 10)
   ```

2. **Set up Inbound Parse webhook**
   - Configure webhook URL: `https://ims-application.onrender.com/webhooks/email/inbound`
   - SendGrid POSTs email data to your webhook

3. **Process emails in real-time**
   - No polling needed
   - Instant processing
   - Full email data including attachments

## Implementation Changes

### 1. Email Processing Service Update
```javascript
// For Cloudflare approach - parse original recipient
async getOriginalRecipient(message) {
    // Check To headers for original recipient
    const toHeader = message.toRecipients;
    for (const recipient of toHeader) {
        const email = recipient.emailAddress.address;
        // Check if it matches our subdomain pattern
        const match = email.match(/^(.+)@(.+)\.42consultingllc\.com$/);
        if (match) {
            return {
                prefix: match[1],
                subdomain: match[2],
                fullEmail: email
            };
        }
    }
    return null;
}
```

### 2. Database Schema
The current schema already supports this:
- `ims_instances.email_subdomain` - stores the subdomain (e.g., "isctest")
- `email_configurations.email_prefix` - stores the prefix (e.g., "docs")
- Full email: `{prefix}@{subdomain}.42consultingllc.com`

### 3. Email Configuration UI
The UI is already showing the correct format. No changes needed.

## Pros and Cons

### Cloudflare Email Routing
**Pros:**
- Free for unlimited emails
- Works with existing Office 365 setup
- Easy to configure
- Preserves all headers
- No code changes to email reading

**Cons:**
- Requires DNS management through Cloudflare
- Adds dependency on Cloudflare

### SendGrid Inbound Parse
**Pros:**
- Real-time processing (no polling)
- Webhook-based (more efficient)
- Detailed email parsing
- No mailbox access needed

**Cons:**
- Requires webhook endpoint
- More complex implementation
- May have volume limits on free tier

## Recommendation
Use **Cloudflare Email Routing** because:
1. Minimal code changes required
2. Free and reliable
3. Works with your existing Office 365 setup
4. Easy to test and rollback

## Next Steps
1. Set up Cloudflare Email Routing
2. Test with a single subdomain first
3. Update email processing to parse original recipient
4. Remove plus addressing code
5. Enable subdomain email creation in UI