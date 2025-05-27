# Office 365 Plus Addressing Setup Guide

This guide explains how to set up plus addressing with Office 365 for the IMS Email Filing system.

## Overview

Since Office 365 (especially when hosted by GoDaddy) doesn't support wildcard email forwarding, we use **plus addressing** instead. This allows you to create unlimited email variations without creating actual mailboxes.

## How It Works

1. **Base Email**: You have one real email address: `documents@42consultingllc.com`
2. **Plus Addresses**: You can receive emails at variations like:
   - `documents+origintest-docs@42consultingllc.com`
   - `documents+origintest-forms@42consultingllc.com`
   - `documents+production-invoices@42consultingllc.com`

3. **Routing**: All plus address variations are automatically delivered to your base `documents@42consultingllc.com` inbox

## Office 365 Configuration

### Step 1: Verify Plus Addressing is Enabled

Plus addressing is enabled by default in Office 365, but to verify:

1. Send a test email to `documents+test@42consultingllc.com`
2. Check if it arrives in the `documents@42consultingllc.com` inbox
3. If it doesn't arrive, contact your Office 365 administrator

### Step 2: Configure Email Rules (Optional)

While not required for the IMS system, you may want to organize incoming emails:

1. Log into Outlook Web App (https://outlook.office.com)
2. Go to Settings → View all Outlook settings → Mail → Rules
3. Click "Add new rule"
4. Create rules based on the "To" address containing specific plus address patterns

Example rule:
- **Name**: IMS Origin Test Documents
- **Condition**: To address contains `documents+origintest-`
- **Action**: Move to folder "IMS/OriginTest"

### Step 3: Grant Application Access

The IMS application needs permission to read emails from your inbox:

1. Have your Office 365 administrator go to Azure AD
2. Grant the IMS application the following permissions:
   - `Mail.Read` - To read emails
   - `Mail.Read.Shared` - To read shared mailbox emails (if using shared mailboxes)

## IMS Application Setup

### For Each Instance

1. **Instance Subdomain**: Each instance has a unique subdomain (e.g., `origintest`, `production`)
2. **Email Prefixes**: Within each instance, you can create multiple prefixes (e.g., `docs`, `forms`, `invoices`)
3. **Generated Address**: The system creates addresses like `documents+{subdomain}-{prefix}@42consultingllc.com`

### Example Configuration

For instance "Origin Test" with subdomain `origintest`:
- Prefix `docs` → `documents+origintest-docs@42consultingllc.com`
- Prefix `forms` → `documents+origintest-forms@42consultingllc.com`
- Prefix `invoices` → `documents+origintest-invoices@42consultingllc.com`

## How Users Send Emails

Users can send documents to IMS in three ways:

1. **TO**: `documents+origintest-docs@42consultingllc.com`
2. **CC**: Include the plus address in CC field
3. **BCC**: Include the plus address in BCC field (for privacy)

## Important Notes

1. **Control Numbers**: Always include the control number in the subject line (e.g., "ID:12345")
2. **Attachments**: All attachments will be filed to IMS
3. **Processing Time**: Emails are processed every 5 minutes
4. **Email Size**: Office 365 typically supports attachments up to 25MB

## Troubleshooting

### Emails Not Being Received
1. Verify the plus address is correctly formatted
2. Check Office 365 spam/junk folders
3. Verify plus addressing is enabled in your tenant

### Emails Not Being Processed
1. Ensure control number is in the subject
2. Check the email processing logs in IMS
3. Verify the instance and prefix configuration is active

## Security Considerations

1. **Access Control**: Only the `documents@42consultingllc.com` mailbox needs to be accessible
2. **Audit Trail**: All processed emails are logged
3. **No Additional Mailboxes**: No need to create or manage additional email accounts
4. **Compliance**: All emails remain in your Office 365 environment

## Support

For assistance with setup or troubleshooting, contact 42consulting support.