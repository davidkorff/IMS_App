CREATE PROCEDURE [dbo].[DK_GetFormContent]
    @formId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return form content for the given form ID
    SELECT 
        f.FormGUID,
        f.FormName,
        f.FormNumber,
        f.Description,
        fc.ContentType,
        fc.Content,
        fc.LastUpdated,
        f.IsRequired,
        f.IsActive
    FROM 
        Form f
    LEFT JOIN 
        FormContent fc ON f.FormID = fc.FormID
    WHERE 
        f.FormGUID = @formId;
END
