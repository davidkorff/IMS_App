CREATE PROCEDURE [dbo].[DK_Policy_ViewDocuments_WS]
    @documentguid UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return document content for the given document GUID
    SELECT 
        d.DocumentGUID,
        d.DocumentName,
        d.DocumentDescription,
        dc.ContentType,
        dc.Content,
        d.UploadDate,
        d.UploadedBy
    FROM 
        Document d
    INNER JOIN 
        DocumentContent dc ON d.DocumentID = dc.DocumentID
    WHERE 
        d.DocumentGUID = @documentguid;
END
