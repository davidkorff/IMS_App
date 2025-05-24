CREATE PROCEDURE [dbo].[DK_Policy_Details_WS]
    @controlno VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return policy details for the given control number
    SELECT 
        p.PolicyID,
        p.PolicyGUID,
        p.ControlNumber,
        p.QuoteGUID,
        p.EffectiveDate,
        p.ExpirationDate,
        p.CustomerName,
        p.InsuredName,
        p.StatusID,
        ps.StatusName,
        p.Premium,
        p.DateCreated,
        p.CreatedBy,
        p.LastUpdated,
        p.UpdatedBy,
        cl.LocationName AS CompanyName,
        l.LineName,
        s.StateCode
    FROM 
        Policy p
    INNER JOIN 
        PolicyStatus ps ON p.StatusID = ps.StatusID
    INNER JOIN 
        CompanyLineState cls ON p.CompanyLineStateID = cls.CompanyLineStateID
    INNER JOIN 
        CompanyLine cl2 ON cls.CompanyLineID = cl2.CompanyLineID
    INNER JOIN 
        CompanyLocation cl ON cl2.CompanyLocationID = cl.CompanyLocationID
    INNER JOIN 
        Line l ON cl2.LineID = l.LineID
    INNER JOIN 
        State s ON cls.StateID = s.StateID
    WHERE 
        p.ControlNumber = @controlno;
END
