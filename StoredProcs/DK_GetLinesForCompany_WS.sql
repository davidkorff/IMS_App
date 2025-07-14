CREATE OR ALTER PROCEDURE [dbo].[DK_GetLinesForCompany_WS]
    @CompanyLocationGUID UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    -- Get lines associated with the specified company
    SELECT DISTINCT
        l.LineGUID,
        l.LineName,
        l.LineID,
        l.LineName AS LineOfBusiness,  -- Use LineName as LineOfBusiness for consistency
        l.LineName AS Description,      -- Use LineName as Description
        cl.CompanyLocationGUID
    FROM lstLines l
    INNER JOIN tblCompanyLines cl ON l.LineGUID = cl.LineGUID  -- Join on LineGUID, not LineID
    WHERE cl.CompanyLocationGUID = @CompanyLocationGUID
    AND l.Inactive = 0  -- 0 = Active (not 1)
    ORDER BY l.LineName;
END