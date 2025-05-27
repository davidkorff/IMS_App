# Custom Plus Address Implementation Summary

## What's Been Implemented

You now have full control over the email addresses used for each email configuration. The system uses the format:

```
documents+[your-custom-suffix]@42consultingllc.com
```

## Key Features

### 1. Create New Email Configurations
- When creating a new email configuration, you'll see an input field for "Email Address Suffix"
- Enter any custom text (letters, numbers, hyphens, underscores)
- The system will create: `documents+[your-text]@42consultingllc.com`
- Example: Entering "origintest-docs" creates `documents+origintest-docs@42consultingllc.com`

### 2. Edit Existing Email Addresses
- Each managed email configuration now has an edit button (pencil icon) next to the email address
- Click the edit button to change the suffix
- The system validates the new suffix and checks for duplicates

### 3. Flexible Routing
The email processor handles both formats:
- **New format**: `documents+[custom-suffix]@42consultingllc.com`
- **Legacy format**: `documents+[subdomain]-[prefix]@42consultingllc.com`

## How to Use

### Creating a New Configuration
1. Go to your instance's email filing page
2. Click "Add Email Configuration"
3. Choose "We Manage Everything"
4. Enter your desired email suffix (e.g., "origintest", "test-docs", "client_invoices")
5. Set the IMS folder ID
6. Click "Create Email Address"

### Editing an Existing Configuration
1. On the email filing dashboard, find your configuration
2. Click the pencil icon next to the email address
3. Enter a new suffix
4. The email address updates immediately

### Updating Your Existing Configuration
To change `documents-origintest@42consultingllc.com` to `documents+origintest@42consultingllc.com`:

1. Run this SQL query in your database:
```sql
UPDATE email_configurations 
SET email_address = 'documents+origintest@42consultingllc.com'
WHERE email_address = 'documents-origintest@42consultingllc.com';
```

Or use the UI:
1. Go to https://ims-application.onrender.com/instance/1/email-filing/1
2. Click the edit button next to the email address
3. Enter "origintest" as the suffix

## Email Processing

- All emails sent to `documents+*@42consultingllc.com` go to your main inbox
- The system reads the inbox every 5 minutes
- It parses the plus address to determine which configuration to use
- Documents are filed to the appropriate IMS instance

## Benefits

1. **No DNS Required**: Works with your existing Office 365 setup
2. **Unlimited Addresses**: Create as many variations as needed
3. **Easy to Remember**: You control the naming convention
4. **Backward Compatible**: Old addresses continue to work