CREATE PROCEDURE [dbo].[DK_GetStates_WS]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active states
    SELECT DISTINCT
        s.StateID,
        s.StateCode,
        s.StateName
    FROM 
        CompanyLineState cls
    INNER JOIN 
        State s ON cls.StateID = s.StateID
    WHERE 
        cls.IsActive = 1
    ORDER BY 
        s.StateName ASC;
END