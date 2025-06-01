CREATE PROCEDURE [dbo].[DK_GetStates_WS]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all US states
    SELECT DISTINCT
        s.StateID,
        s.StateID AS StateCode,  -- StateID is the code (AL, AK, etc.)
        s.State AS StateName
    FROM 
        lstStates s
    WHERE 
        s.IsUsState = 1  -- Only US states
    ORDER BY 
        s.State ASC;
END