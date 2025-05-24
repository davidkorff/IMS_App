CREATE PROCEDURE [dbo].[DK_GetCompanyLineForms_WS]
    @companyLineStateId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active forms for the given company line state
    SELECT 
        f.FormID,
        f.FormGUID,
        f.FormName,
        f.FormNumber,
        f.Description,
        f.FormTypeID,
        ft.FormTypeName,
        f.IsRequired,
        f.IsActive
    FROM 
        Form f
    INNER JOIN 
        CompanyLineStateForm clsf ON f.FormID = clsf.FormID
    INNER JOIN 
        FormType ft ON f.FormTypeID = ft.FormTypeID
    WHERE 
        clsf.CompanyLineStateGUID = @companyLineStateId
        AND f.IsActive = 1
    ORDER BY 
        f.FormName ASC;
END
