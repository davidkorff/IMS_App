# Document Visibility Fix - IMS Email Filing

## Problem Identified
Documents uploaded via `InsertStandardDocument` were receiving valid GUIDs but were not visible in the IMS UI because they lacked the required association records in `tblDocumentAssociations`.

## Root Cause Analysis
Based on IMS documentation analysis:

- **`InsertStandardDocument`**: Creates document in `tblDocumentStore` but does NOT create associations
- **`InsertAssociatedDocument`**: Creates document AND creates the association in `tblDocumentAssociations`
- **`InsertTypedDocumentAssociatedToPolicy`**: Creates document AND associates it to a policy using policy number

## The Fix Applied

### Before (services/emailFilingService.js:679-725)
```javascript
// OLD CODE - tried InsertStandardDocument first, then InsertAssociatedDocument with wrong entity params
try {
    console.log('Attempting InsertStandardDocument first...');
    const standardDocGuid = await this.uploadStandardDocument(instance, token, documentData, userGuid, config);
    return standardDocGuid; // This created documents WITHOUT associations
} catch (standardError) {
    // Fallback with WRONG entity parameters:
    <entity>
        <EntityGuid>00000000-0000-0000-0000-000000000000</EntityGuid>  // WRONG: Should be QuoteGuid
        <ControlGuid>${controlGuid}</ControlGuid>                      // WRONG: Should be null GUID
        <EntityName>Email Communication</EntityName>
        <EntityType>Quote</EntityType>
        <EntityAssociation>Quote</EntityAssociation>
    </entity>
}
```

### After (services/emailFilingService.js:679-725)
```javascript
// NEW CODE - uses InsertAssociatedDocument directly with CORRECT entity params
console.log('Using InsertAssociatedDocument to create proper quote association...');

<entity>
    <EntityGuid>${controlGuid}</EntityGuid>                         // CORRECT: QuoteGuid from control validation
    <ControlGuid>00000000-0000-0000-0000-000000000000</ControlGuid> // CORRECT: Null GUID as per documentation
    <EntityName>Email Communication</EntityName>
    <EntityType>Quote</EntityType>
    <EntityAssociation>Quote</EntityAssociation>
</entity>
```

## Expected Database Changes

### Before Fix
- `tblDocumentStore`: ✅ Document created with valid GUID
- `tblDocumentAssociations`: ❌ NO association record created
- **Result**: Document exists but invisible in IMS UI

### After Fix  
- `tblDocumentStore`: ✅ Document created with valid GUID
- `tblDocumentAssociations`: ✅ Association record created with:
  - `DocumentGuid` = returned document GUID
  - `EntityGuid` = QuoteGuid (from control number lookup)
  - `EntityType` = "Quote"
- **Result**: Document visible in IMS UI under correct control number/policy

## Control Number to Document Linking Process

1. **Control Number** → `tblQuotes.controlno` 
2. **Quote Record** → `tblQuotes.QuoteGuid`
3. **Document Association** → `tblDocumentAssociations` where:
   - `EntityGuid` = `tblQuotes.QuoteGuid` 
   - `EntityType` = "Quote"
   - `DocumentGuid` = document GUID
4. **Document Storage** → `tblDocumentStore.DocumentGuid`

## Verification Query
```sql
-- This query should now return documents for control number 10000
SELECT 
    q.controlno,
    q.QuoteGuid,
    da.EntityGuid,
    da.DocumentGuid,
    da.EntityType,
    ds.DocumentName,
    ds.FolderID,
    ds.DocumentLocation
FROM tblQuotes q
LEFT JOIN tblDocumentAssociations da ON q.QuoteGuid = da.EntityGuid  
LEFT JOIN tblDocumentStore ds ON da.DocumentGuid = ds.DocumentGuid
WHERE q.controlno = '10000'
  AND da.EntityType = 'Quote';
```

## Files Modified
- `services/emailFilingService.js`: Fixed `uploadDocumentToIMSByControl` method
- Removed unused `uploadStandardDocument` method

## Test Status
- Code fix implemented and validated against IMS documentation
- Authentication issues prevent live testing with demo credentials
- Fix addresses the identified root cause: missing `tblDocumentAssociations` records

## Next Steps
1. Test with working IMS credentials when available
2. Verify documents appear in IMS UI after upload
3. Confirm proper associations in database
4. Proceed with Zapier integration once document visibility is confirmed