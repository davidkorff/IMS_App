-- Investigation queries to understand document linking in IMS database

-- 1. First, let's understand the structure of key tables
-- Check tblDocumentStore structure
SELECT TOP 5 * FROM tblDocumentStore ORDER BY 1 DESC;

-- Check tblDocumentAssociations structure  
SELECT TOP 5 * FROM tblDocumentAssociations ORDER BY 1 DESC;

-- Check tblQuotes structure for control numbers
SELECT TOP 5 controlno, QuoteGuid, PolicyNumber, InsuredGuid 
FROM tblQuotes 
WHERE controlno = '10000' OR controlno LIKE '10000%';

-- 2. Look for our test documents by GUID
-- Search for our test document GUIDs in tblDocumentStore
SELECT * FROM tblDocumentStore 
WHERE DocumentGuid IN (
    '38370ea0-c2fd-42c7-a246-3381032a5770',
    'ac8be2f6-91c3-4d3b-8839-4133fc45c3f8'
);

-- 3. Check document associations for our test docs
SELECT da.*, ds.DocumentName, ds.FolderID, ds.DocumentLocation
FROM tblDocumentAssociations da
LEFT JOIN tblDocumentStore ds ON da.DocumentGuid = ds.DocumentGuid
WHERE da.DocumentGuid IN (
    '38370ea0-c2fd-42c7-a246-3381032a5770', 
    'ac8be2f6-91c3-4d3b-8839-4133fc45c3f8'
);

-- 4. Find the relationship pattern - how are documents linked to quotes?
-- Look for any documents associated with control number 10000
SELECT 
    q.controlno,
    q.QuoteGuid,
    q.PolicyNumber,
    da.EntityGuid,
    da.DocumentGuid,
    ds.DocumentName,
    ds.FolderID,
    ds.DocumentLocation,
    ds.ActualFileSize,
    ds.OriginalFileSize
FROM tblQuotes q
LEFT JOIN tblDocumentAssociations da ON q.QuoteGuid = da.EntityGuid  
LEFT JOIN tblDocumentStore ds ON da.DocumentGuid = ds.DocumentGuid
WHERE q.controlno = '10000';

-- 5. Alternative linking - check if documents link directly to quotes
SELECT 
    q.controlno,
    q.QuoteGuid, 
    ds.DocumentGuid,
    ds.DocumentName,
    ds.FolderID,
    ds.DocumentLocation,
    ds.ActualFileSize,
    ds.OriginalFileSize,
    ds.CreatedDate
FROM tblQuotes q
LEFT JOIN tblDocumentStore ds ON q.QuoteGuid = ds.EntityGuid
WHERE q.controlno = '10000';

-- 6. Check recent documents (last 24 hours) to see what was created
SELECT TOP 20
    DocumentGuid,
    DocumentName, 
    FolderID,
    DocumentLocation,
    ActualFileSize,
    OriginalFileSize,
    CreatedDate,
    EntityGuid
FROM tblDocumentStore 
WHERE CreatedDate > DATEADD(hour, -24, GETDATE())
ORDER BY CreatedDate DESC;

-- 7. Understand folder structure
SELECT 
    FolderID,
    FolderName,
    ParentFolderID,
    IsActive
FROM tblDocumentFolders
WHERE FolderID IN (0, 1, 2, 3, 4, 5) -- Check common folder IDs
ORDER BY FolderID;

-- 8. Check document types
SELECT 
    TypeGuid,
    TypeName,
    IsActive
FROM tblDocumentTypes
WHERE IsActive = 1;

-- 9. Look for patterns in existing document associations
SELECT TOP 10
    da.EntityType,
    da.AssociationType, 
    COUNT(*) as doc_count
FROM tblDocumentAssociations da
GROUP BY da.EntityType, da.AssociationType
ORDER BY doc_count DESC;

-- 10. Find any documents with our test names
SELECT 
    DocumentGuid,
    DocumentName,
    FolderID, 
    DocumentLocation,
    ActualFileSize,
    OriginalFileSize,
    CreatedDate
FROM tblDocumentStore
WHERE DocumentName LIKE '%Test_%' 
   OR DocumentName LIKE '%10000%'
   OR DocumentName LIKE '%Email%'
ORDER BY CreatedDate DESC;