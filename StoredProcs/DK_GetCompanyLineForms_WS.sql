CREATE PROCEDURE [dbo].[DK_GetCompanyLineForms_WS]
    @LineID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all forms for the given line
    SELECT 
        f.FormID,
        f.FormGUID,
        f.FormName,
        f.FormNumber,
        f.Description,
        f.FormTypeID,
        ft.FormTypeName,
        f.IsRequired,
        f.IsActive,
        f.FormContent
    FROM 
        Form f
    INNER JOIN 
        FormType ft ON f.FormTypeID = ft.FormTypeID
    LEFT JOIN 
        CompanyLineForm clf ON f.FormID = clf.FormID
    WHERE 
        (@LineID IS NULL OR clf.LineID = @LineID)
        AND f.IsActive = 1
    ORDER BY 
        f.FormName ASC;
END