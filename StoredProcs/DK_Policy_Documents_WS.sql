CREATE PROCEDURE [dbo].[DK_Policy_Documents_WS]
    @quoteguid UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return documents for the given quote GUID
    SELECT 
        d.DocumentID,
        d.DocumentGUID,
        d.DocumentName,
        d.DocumentDescription,
        d.DocumentTypeID,
        dt.DocumentTypeName,
        d.FileSize,
        d.UploadDate,
        d.UploadedBy,
        d.IsActive
    FROM 
        Document d
    INNER JOIN 
        DocumentType dt ON d.DocumentTypeID = dt.DocumentTypeID
    INNER JOIN 
        QuoteDocument qd ON d.DocumentID = qd.DocumentID
    WHERE 
        qd.QuoteGUID = @quoteguid
        AND d.IsActive = 1
    ORDER BY 
        d.UploadDate DESC;
END
