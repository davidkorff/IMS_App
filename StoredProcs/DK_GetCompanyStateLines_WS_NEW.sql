-- Drop existing procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DK_GetCompanyStateLines_WS]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[DK_GetCompanyStateLines_WS]
GO

CREATE PROCEDURE [dbo].[DK_GetCompanyStateLines_WS]
    @CompanyLocationGUID UNIQUEIDENTIFIER = NULL,
    @LineGUID UNIQUEIDENTIFIER = NULL,
    @StateID NVARCHAR(2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return forms based on company/line/state combinations
    SELECT DISTINCT
        f.FormsConditionsWarrantiesID AS FormID,
        f.FormGUID,
        f.FormTitle AS FormName,
        f.FormNumber,
        f.FormTitle AS Description,
        cl.CompanyLineID,
        cl.CompanyLineGUID,
        cl.CompanyLocationGUID,
        cloc.LocationName AS CompanyName,
        cl.LineGUID,
        l.LineName,
        cl.StateID,
        s.State AS StateName,
        f.FormTypeID,
        ft.FormTypeName,
        f.Active AS IsActive
    FROM 
        tblCompanyLines cl
    INNER JOIN 
        tblCompanyLocations cloc ON cl.CompanyLocationGUID = cloc.CompanyLocationGUID
    INNER JOIN 
        lstLines l ON cl.LineGUID = l.LineGUID
    INNER JOIN 
        lstStates s ON cl.StateID = s.StateID
    INNER JOIN
        tblCompanyFormsConditionsWarranties f ON f.CompanyLineID = cl.CompanyLineID
    LEFT JOIN
        lstFormTypes ft ON f.FormTypeID = ft.FormTypeID
    WHERE 
        cl.StatusID = 1  -- Active
        AND cl.Hidden = 0
        AND cloc.StatusID = 1
        AND cloc.Hidden = 0
        AND l.Inactive = 0
        AND s.IsUsState = 1
        AND f.Active = 1
        AND (@CompanyLocationGUID IS NULL OR cl.CompanyLocationGUID = @CompanyLocationGUID)
        AND (@LineGUID IS NULL OR cl.LineGUID = @LineGUID)
        AND (@StateID IS NULL OR cl.StateID = @StateID)
    ORDER BY 
        cloc.LocationName, l.LineName, s.State, f.FormTitle;
END