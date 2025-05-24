# Zapier Email Filing Setup Guide

## Workflow Overview

**Email Processing Flow:**
1. **Monitor** `documents@42consultingllc.com` for new emails
2. **Extract control number** from beginning of subject line (1-9 digits, optionally preceded by "RE:")
3. **Validate control number** against IMS database  
4. **File entire email** as HTML document to the policy's document system
5. **Log transaction** for audit trail

## Step 1: Set Up Email Filing Configuration

1. **Login to your IMS application** at `http://localhost:5000`
2. **Go to Dashboard** → Select your IMS instance → Click **"Email Filing"**
3. **Create New Configuration:**
   - **Name**: "42 Consulting Email Filing"
   - **Default Folder ID**: (Optional - leave blank for default)
   - **Auto-extract Control Numbers**: ✅ Checked
   - **Control Number Patterns**: Leave blank (uses default patterns for 1-9 digit numbers)
   - **Convert email to PDF**: ✅ Checked  
   - **Include attachments**: ✅ Checked

4. **Copy the Webhook URL** - you'll need this for Zapier

## Step 2: Create Zapier Account & Zap

### A. Create Zapier Account
1. Go to [zapier.com](https://zapier.com) and sign up
2. Choose the free plan to start

### B. Create New Zap
1. Click **"Create Zap"**
2. **Trigger App**: Choose **"Outlook"** (for your @42consulting.com emails)

### C. Configure Email Trigger

**If using Outlook (Recommended for your setup):**
- **Trigger Event**: "New Email" or "New Email Matching Search"
- **Connect Outlook Account**: Connect the account that has access to `documents@42consultingllc.com`
- **Folder**: Choose the folder where emails to `documents@42consultingllc.com` arrive (usually "Inbox")
- **Search/Filter**: Set up filter for emails sent to `documents@42consultingllc.com`

**If using Gmail:**
- **Trigger Event**: "New Email Matching Search" 
- **Connect Gmail Account**: Connect the account that has access to `documents@42consultingllc.com`
- **Search String**: `to:documents@42consultingllc.com`

**If using "Email by Zapier":**
- **Trigger Event**: "New Inbound Email"
- **Set up webhook email address** as provided by Zapier
- **Forward emails** from `documents@42consultingllc.com` to this address

## Step 3: Configure Webhook Action

1. **Add Action Step** in your Zap
2. **Choose App**: "Webhooks by Zapier"
3. **Action Event**: "POST"
4. **Configure Webhook:**
   - **URL**: Paste your webhook URL from Step 1
   - **Payload Type**: "JSON"
   - **Data** (map these fields exactly):

```json
{
  "subject": "Email Subject",
  "from": "From Email", 
  "to": "To Email",
  "body_text": "Body Plain",
  "body_html": "Body HTML",
  "date": "Date",
  "message_id": "Message ID"
}
```

## Step 4: Test the Integration

### Test Email Format:
Send a test email to `documents@42consultingllc.com` with:

**Subject**: `123456789 - Policy Question`
**Subject**: `RE: 987654321 - Claim Update`

### Verify Processing:
1. **Send test email** 
2. **Check Zapier Activity** - webhook should trigger
3. **Check IMS Email Filing** → Activity Log for processing results
4. **Verify in IMS** that document was filed to policy

## Step 5: Control Number Patterns

Your system will automatically detect:

- **Basic Format**: `123456789` (any 1-9 digit number at start of subject)
- **Reply Format**: `RE: 123456789` (preceded by "RE:")
- **Mixed Format**: `RE: 12345 - Policy Update` (extracts just the number)

## Troubleshooting

### Common Issues:

**❌ "No control numbers found"**
- Check subject line has 1-9 digit number at beginning
- Verify email content in Activity Log

**❌ "Invalid control number"** 
- Control number doesn't exist in IMS database
- Check IMS for correct policy number

**❌ "Webhook not receiving emails"**
- Verify Zapier trigger is configured correctly
- Check Zapier activity log for errors
- Test webhook URL manually

**❌ "Document upload failed"**
- IMS authentication token may have expired
- Check IMS instance credentials

### Debug Information:
- All webhook requests logged with unique IDs
- Activity log shows detailed error messages  
- Test endpoints verify connectivity

## Expected Results

**Successful Processing:**
1. Email arrives at `documents@42consultingllc.com`
2. Zapier forwards to your webhook
3. System extracts control number from subject
4. Control number validated against IMS
5. Email converted to HTML document  
6. Document filed to policy in IMS
7. Success logged in Activity Log

**Email Format in IMS:**
- **Document Name**: `Email_123456789_2024-05-24.html`
- **Description**: `Email: [Original Subject Line]`
- **Content**: Full email with headers and body
- **Associated To**: Policy with control number 123456789

## Production Deployment

Once testing is successful:

1. **Turn on Zapier Zap** for live processing
2. **Monitor Activity Log** for any issues
3. **Set up email forwarding** if needed
4. **Train staff** on expected email formats

Your email filing system is now ready to automatically process emails sent to `documents@42consultingllc.com` and file them against the appropriate policies in IMS based on control numbers in the subject line!