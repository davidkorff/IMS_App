CREATE PROCEDURE [dbo].[DK_GetStates_WS]
    @companyLineId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all active states for the given company line
    SELECT 
        cls.CompanyLineStateID,
        cls.CompanyLineStateGUID,
        s.StateCode,
        s.StateName,
        cls.IsActive
    FROM 
        CompanyLineState cls
    INNER JOIN 
        State s ON cls.StateID = s.StateID
    WHERE 
        cls.CompanyLineGUID = @companyLineId
        AND cls.IsActive = 1
    ORDER BY 
        s.StateName ASC;
END
