CREATE PROCEDURE [dbo].[DK_GetLines_WS]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active lines
    SELECT DISTINCT
        l.LineID AS CompanyLineID,
        l.LineGUID AS CompanyLineGUID,
        l.LineName,
        l.LineName AS LineDescription,
        CASE WHEN l.Inactive = 0 THEN 1 ELSE 0 END AS IsActive
    FROM 
        lstLines l
    WHERE 
        l.Inactive = 0  -- 0 = Active
    ORDER BY 
        l.LineName ASC;
END