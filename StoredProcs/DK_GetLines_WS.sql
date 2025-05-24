CREATE PROCEDURE [dbo].[DK_GetLines_WS]
    @companyId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active lines for the given company
    SELECT 
        cl.CompanyLineID,
        cl.CompanyLineGUID,
        l.LineName,
        l.LineDescription,
        cl.IsActive
    FROM 
        CompanyLine cl
    INNER JOIN 
        Line l ON cl.LineID = l.LineID
    WHERE 
        cl.CompanyLocationGUID = @companyId
        AND cl.IsActive = 1
    ORDER BY 
        l.LineName ASC;
END
