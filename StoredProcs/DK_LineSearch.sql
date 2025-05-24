CREATE PROCEDURE [dbo].[DK_LineSearch]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active lines
    SELECT 
        l.LineID,
        l.LineGUID,
        l.LineName,
        l.LineDescription,
        l.IsActive
    FROM 
        Line l
    WHERE 
        l.IsActive = 1
    ORDER BY 
        l.LineName ASC;
END
