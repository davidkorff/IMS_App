# Producer Portal Workflow

## Overview
The Producer Portal has been enhanced with a two-stage submission form that collects both mandatory IMS data and custom LOB-specific fields.

## What's Been Completed

### 1. Enhanced Submission Form
- Created `producer-new-submission-enhanced.html` with a 3-step process:
  - **Step 1: Insured Information** - Collects mandatory IMS fields
  - **Step 2: Application Details** - Displays custom form from Form Builder
  - **Step 3: Review & Submit** - Review all data before submission

### 2. Form Integration
- Updated all routes to use the enhanced submission form
- Form properly separates IMS-required data from custom LOB fields
- Supports both individual and business insured types

### 3. Mandatory IMS Fields Collected
Based on IMS documentation:
- Business Type (Individual/Corporation/Partnership/LLC/Other)
- Name fields (First/Middle/Last for individuals, Corporation Name/DBA for businesses)
- Location (Address, City, State, ZIP)
- Contact information (Phone, Email)
- Optional fields: SSN, FEIN, Date of Birth

## Next Steps to Complete the Workflow

### 1. Register a Test Producer
```bash
cd /mnt/c/Users/david/OneDrive/Documents/IMS_Application
node scripts/register-test-producer.js
```

### 2. Approve the Producer
Since email verification is manual for now:
```bash
psql -U postgres -d ims_db -f scripts/approve-producer.sql
```

### 3. Test the Complete Workflow
1. Access the producer portal:
   - Direct URL: http://localhost:5000/producer-login?instance=4
   - Or via subdomain if hosts file is working: http://isc.localhost:5000

2. Login with test producer:
   - Email: john.producer@example.com
   - Password: Producer123!

3. Create a new submission:
   - Click "New Submission" from dashboard
   - Select the Line of Business
   - Fill out the mandatory IMS fields (Step 1)
   - Complete any custom form fields (Step 2)
   - Review and submit (Step 3)

### 4. IMS Integration (To Be Implemented)
The submission data is currently stored in the database. To complete the IMS integration:

1. Call `AddInsuredWithContact` to create the insured in IMS
2. Call `AddSubmission` with the returned InsuredGuid
3. Process the submission through the Excel rater for premium calculation
4. Update submission status with IMS quote number

## Database Tables Involved
- `producers` - Producer accounts
- `producer_lob_access` - LOB permissions
- `custom_route_submissions` - Submission data
- `producer_submissions` - Links submissions to producers
- `portal_lines_of_business` - Available LOBs

## Form Data Structure
The enhanced form sends data in this structure:
```json
{
  "lob_id": 8,
  "form_data": {
    "imsData": {
      "businessType": "2",
      "corporationName": "ABC Corp",
      "address1": "123 Main St",
      "city": "Chicago",
      "state": "IL",
      "zip": "60601",
      "phone": "555-0123",
      "email": "contact@abc.com"
    },
    "customData": {
      // Fields from Form Builder
    }
  },
  "ims_data": { /* Same as imsData */ },
  "custom_data": { /* Same as customData */ }
}
```