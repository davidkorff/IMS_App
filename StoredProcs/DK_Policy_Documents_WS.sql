GO
/****** Object:  StoredProcedure [dbo].[DK_Policy_Documents_WS]    Script Date: 5/31/2025 11:53:26 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[DK_Policy_Documents_WS]
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
