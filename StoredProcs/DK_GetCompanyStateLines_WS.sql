CREATE PROCEDURE [dbo].[DK_GetCompanyStateLines_WS]
    @LineGUID UNIQUEIDENTIFIER = NULL,
    @CompanyLocationGUID UNIQUEIDENTIFIER = NULL,
    @StateID NVARCHAR(2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return forms based on filters
    SELECT DISTINCT
        f.FormID,
        f.FormGUID,
        f.FormName,
        f.FormNumber,
        f.Description,
        f.FormTypeID,
        ft.FormTypeName,
        f.IsRequired,
        f.IsActive,
        cl.CompanyLocationGUID,
        cl.LocationName,
        l.LineGUID,
        l.LineName,
        s.StateID,
        s.StateName
    FROM 
        Form f
    INNER JOIN 
        FormType ft ON f.FormTypeID = ft.FormTypeID
    INNER JOIN 
        CompanyLineStateForm clsf ON f.FormID = clsf.FormID
    INNER JOIN 
        CompanyLineState cls ON clsf.CompanyLineStateID = cls.CompanyLineStateID
    INNER JOIN 
        CompanyLine cl ON cls.CompanyLineID = cl.CompanyLineID
    INNER JOIN 
        Line l ON cl.LineID = l.LineID
    INNER JOIN 
        State s ON cls.StateID = s.StateID
    WHERE 
        f.IsActive = 1
        AND (@LineGUID IS NULL OR l.LineGUID = @LineGUID)
        AND (@CompanyLocationGUID IS NULL OR cl.CompanyLocationGUID = @CompanyLocationGUID)
        AND (@StateID IS NULL OR s.StateID = @StateID)
    ORDER BY 
        f.FormName ASC;
END