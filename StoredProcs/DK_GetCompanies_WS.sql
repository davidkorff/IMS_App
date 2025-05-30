CREATE PROCEDURE [dbo].[DK_GetCompanies_WS]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active company locations
    SELECT 
        cl.CompanyLocationGUID,
        cl.LocationName,
        c.CompanyName,
        cl.IsActive
    FROM 
        CompanyLocation cl
    INNER JOIN 
        Company c ON cl.CompanyID = c.CompanyID
    WHERE 
        cl.IsActive = 1
    ORDER BY 
        cl.LocationName ASC;
END