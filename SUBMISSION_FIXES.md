# IMS Submission Fixes Applied

## Issues Fixed:

1. **BusinessTypeID Foreign Key Constraint**
   - Changed from generic IDs (1,2,3) to IMS-specific IDs
   - Individual: 4
   - Corporation: 13
   - Partnership: 2
   - LLC: 9
   - Other: 5

2. **Missing Required Fields**
   - Added `ISOCountryCode: 'US'` to location data
   - Added `LocationTypeID: 1` (Primary Location) to location data
   - Updated SOAP envelope to include LocationTypeID field

3. **Authentication**
   - Fixed to use instance-based credentials instead of environment variables
   - Credentials are now pulled from the `ims_instances` table

## Next Steps:

1. Deploy `StoredProcs/DK_GetTableData_WS.sql` to IMS database
2. Test submission again - all required fields should now be present
3. If additional fields are required, IMS will report them one at a time

## Testing:

1. Go to http://localhost:5000/producer/new-submission/8
2. Fill out the two-stage form
3. Submit and check if the submission processes successfully in IMS