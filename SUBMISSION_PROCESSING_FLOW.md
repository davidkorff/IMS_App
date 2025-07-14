# Producer Submission Processing Flow

## Overview
When a producer submits an application through the portal, it now automatically processes through IMS and returns a control number and premium (if available).

## Processing Steps

### 1. Submission Creation
- Producer fills out the enhanced two-stage form
- Data is saved to `custom_route_submissions` table
- Status: `pending`

### 2. Automatic Processing (Background)
The system automatically:

1. **Creates Insured in IMS**
   - Calls `AddInsuredWithContact` 
   - Creates insured, location, and contact records
   - Returns `InsuredGuid`

2. **Creates Submission & Quote in IMS**
   - Calls `AddQuoteWithSubmission`
   - Links to the created insured
   - Uses producer contact GUID if available
   - Returns `QuoteGuid`

3. **Gets Control Number**
   - Calls `GetControlNumber` with the QuoteGuid
   - Returns the IMS control number

4. **Processes Excel Rater** (TODO)
   - Currently returns placeholder premium of $1500
   - Future: Process actual Excel rater file

5. **Updates Submission Status**
   - Status: `quoted`
   - Stores control number, quote GUID, premium

### 3. Producer Contact Handling

The system handles producer contacts in three ways:

1. **Linked Producer**: If admin has linked the producer to an IMS contact GUID
2. **Auto-Search**: System searches IMS by producer email
3. **Fallback**: Uses company GUID if no producer contact found

## API Endpoints

### Submit Application
```
POST /api/producer/submissions
{
  "lob_id": 8,
  "form_data": {
    "imsData": { ... },
    "customData": { ... }
  }
}
```

Response includes submission_id for tracking.

### Check Processing Status
```
GET /api/producer/submissions/{submissionId}/status
```

Returns:
```json
{
  "submission_id": 123,
  "status": "quoted",
  "control_number": "12345",
  "premium": 1500.00,
  "ims_quote_guid": "...",
  "processing_complete": true
}
```

### Manual Processing (if needed)
```
POST /api/producer/submissions/{submissionId}/process
```

## Database Changes

Added to `producers` table:
- `ims_contact_guid` - Links to IMS ProducerContact
- `ims_producer_location_guid` - Links to IMS ProducerLocation

## Admin Features

### Search IMS for Producer
```
POST /api/producer-admin/producers/search-ims
{
  "email": "producer@example.com"
}
```

### Link Producer to IMS Contact
```
POST /api/producer-admin/producers/{producerId}/link-ims
{
  "ims_contact_guid": "...",
  "ims_producer_location_guid": "..."
}
```

## Configuration Required

Set these environment variables:
- `IMS_BASE_URL` - IMS web service URL
- `IMS_TOKEN` - Authentication token
- `IMS_CONTEXT` - Context string

## Next Steps

1. **Excel Rater Integration**
   - Implement actual Excel file processing
   - Map form fields to Excel cells
   - Extract calculated premium

2. **Error Handling**
   - Add retry mechanism for failed submissions
   - Better error messages for users

3. **Email Notifications**
   - Notify producer when quote is ready
   - Send control number and premium

4. **IMS Document Generation**
   - Generate quote documents
   - Store in IMS document system