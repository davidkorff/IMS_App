GO
/****** Object:  StoredProcedure [dbo].[DK_Policy_ViewDocuments_WS]    Script Date: 5/31/2025 11:53:36 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[DK_Policy_ViewDocuments_WS]
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
