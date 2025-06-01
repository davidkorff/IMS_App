CREATE PROCEDURE [dbo].[DK_GetCompanies_WS]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active company locations
    SELECT DISTINCT
        cl.CompanyLocationGUID,
        cl.LocationName,
        cl.Name AS CompanyName,
        CASE WHEN cl.StatusID = 1 THEN 1 ELSE 0 END AS IsActive
    FROM 
        tblCompanyLocations cl
    WHERE 
        cl.StatusID = 1  -- Assuming 1 = Active
        AND cl.Hidden = 0
    ORDER BY 
        cl.LocationName ASC;
END