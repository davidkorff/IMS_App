CREATE PROCEDURE [dbo].[DK_GetLines_WS]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active lines
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
        cl.IsActive = 1
    ORDER BY 
        l.LineName ASC;
END