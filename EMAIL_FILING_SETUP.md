# Email Filing System Setup Guide

## What's Been Built

I've successfully implemented a complete email filing system for your IMS application that allows:

1. **Multiple Email Filing Configurations** per IMS instance
2. **Zapier Integration** to receive emails from Outlook/Gmail  
3. **Automatic Control Number Extraction** from email content
4. **Document Filing** to IMS policies via control numbers
5. **Comprehensive Audit Trail** of all email filing activities
6. **Manual Email Filing** for testing and one-off situations

## Files Created/Modified

### Database Schema
- `migrations/001_email_filing_tables.sql` - Database tables for email filing

### Backend Services  
- `services/emailFilingService.js` - Core email processing logic
- `routes/emailFiling.js` - Email filing API endpoints
- `routes/webhooks.js` - Zapier webhook endpoints
- `server.js` - Updated with new routes

### Frontend UI
- `public/email-filing.html` - Complete email filing management interface
- `public/instance.html` - Added email filing navigation tile

### Documentation
- `IMPLEMENTATION_LOG.md` - Detailed implementation tracking
- `EMAIL_FILING_SETUP.md` - This setup guide

## Setup Steps

### 1. Run Database Migration
```sql
-- Execute this in your PostgreSQL database
\i migrations/001_email_filing_tables.sql
```

### 2. Start the Application
```bash
npm start
# or
node server.js
```

### 3. Access Email Filing
1. Login to your application
2. Go to Dashboard
3. Click on an IMS instance
4. Click the new "Email Filing" tile

### 4. Create Email Filing Configuration
1. In the Email Filing interface, click "New Configuration"
2. Fill out the form:
   - **Name**: Descriptive name (e.g., "Customer Service Emails")
   - **Default Folder ID**: Optional IMS folder ID
   - **Control Number Patterns**: Leave blank for defaults
   - **Options**: Enable auto-extract, PDF conversion, attachments

3. Copy the generated webhook URL

### 5. Set Up Zapier Integration

#### Create Zapier Zap:
1. Go to [Zapier.com](https://zapier.com) and create account
2. Click "Create Zap"
3. **Trigger**: Choose "Gmail" or "Outlook"
   - Event: "New Email" or "New Email Matching Search"
   - Configure filters (optional - e.g., specific folder, subject contains text)

4. **Action**: Choose "Webhooks by Zapier"
   - Event: "POST"
   - URL: Your webhook URL from step 4
   - Payload Type: "JSON"
   - Data: Map these fields:
     ```
     subject: Email Subject
     from: From Email
     to: To Email  
     body_text: Body Plain
     body_html: Body HTML
     date: Date
     message_id: Message ID
     ```

5. Test the Zap and turn it on

## How It Works

### Email Processing Flow:
1. **Zapier receives email** from Outlook/Gmail
2. **Zapier sends webhook** to your application
3. **Application extracts control numbers** using regex patterns
4. **Application validates control number** against IMS
5. **Application converts email to HTML document**
6. **Application uploads document to IMS** via existing services
7. **Application logs the transaction** for audit

### Default Control Number Patterns:
- `ABC123456789` (2-4 letters + 6-10 digits)
- `123456789` (8-12 digits only)
- `POL123456` (POL prefix + alphanumeric)
- `QUO123456` (QUO prefix + alphanumeric)  
- `ABC-123456` (letters-digits with hyphen)

## Features Available

### Email Filing Dashboard
- **Statistics**: Total emails, success rate, recent activity
- **Configuration Management**: Create, edit, delete configurations
- **Activity Log**: View all email filing attempts with details
- **Manual Filing**: Test email filing manually

### Webhook Management
- **Unique webhook URLs** for each configuration
- **Test endpoints** to verify connectivity
- **Security**: Optional webhook secrets
- **Statistics**: Processing metrics per configuration

### Advanced Features
- **Control Number Testing**: Test extraction patterns before going live
- **Multiple Configurations**: Different setups for different email types
- **Attachment Support**: Include email attachments in filing
- **Error Handling**: Comprehensive error logging and retry logic

## API Endpoints

### Webhook Endpoints
- `POST /api/webhooks/zapier/:configId/email` - Receive emails from Zapier
- `GET /api/webhooks/zapier/:configId/test` - Test webhook connectivity

### Management Endpoints  
- `GET /api/email-filing/configs` - List configurations
- `POST /api/email-filing/configs` - Create configuration
- `GET /api/email-filing/logs` - View activity logs
- `POST /api/email-filing/manual` - Manual email filing
- `GET /api/email-filing/stats` - Get filing statistics

## Testing

### Manual Testing:
1. Go to Email Filing → Manual Filing tab
2. Enter test email data with a control number
3. Click "Test Control Number Extraction" to verify patterns
4. Click "File Email" to test the full process

### Zapier Testing:
1. Send a test email with a control number to your monitored inbox
2. Check the Activity Log for processing results
3. Verify the document was filed in IMS

## Troubleshooting

### Common Issues:
1. **No control numbers found**: Check your email content and patterns
2. **Invalid control number**: Verify control number exists in IMS
3. **Authentication failed**: Check IMS credentials in instance configuration
4. **Webhook not receiving**: Verify Zapier configuration and URL

### Debug Information:
- All webhook requests are logged with unique request IDs
- Activity log shows detailed error messages
- Test endpoints provide connectivity verification

## Next Steps

1. **Run the database migration**
2. **Test the functionality** with manual filing
3. **Set up your first Zapier integration**
4. **Monitor the activity logs** for successful processing
5. **Scale to additional email sources** as needed

The system is designed to be robust, scalable, and easy to manage. Each email filing configuration can handle different email sources, patterns, and IMS instances independently.