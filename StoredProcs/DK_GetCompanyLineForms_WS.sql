-- Drop existing procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DK_GetCompanyLineForms_WS]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[DK_GetCompanyLineForms_WS]
GO

CREATE PROCEDURE [dbo].[DK_GetCompanyLineForms_WS]
    @LineID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Return all forms for the given company line
    SELECT DISTINCT
        fcw.PolicyFormID AS FormID,  -- This is what we need for DK_GetFormContent_WS
        fcw.Company_FCW_ID AS CompanyFormID,
        NEWID() AS FormGUID,
        COALESCE(pf.FormName, 'Policy Form') AS FormName,
        COALESCE(pf.FormNumber, 'N/A') AS FormNumber,
        COALESCE(pf.FormName, 'Policy Form') AS Description,
        1 AS FormTypeID,
        'Policy Form' AS FormTypeName,
        CAST(fcw.Mandatory AS BIT) AS IsRequired,
        CASE WHEN fcw.Disabled IS NULL THEN 1 ELSE 0 END AS IsActive,
        '' AS FormContent,
        fcw.DocumentOrder
    FROM 
        tblCompanyFormsConditionsWarranties fcw
    LEFT JOIN 
        tblPolicyForms pf ON fcw.PolicyFormID = pf.FormID
    WHERE 
        fcw.CompanyLineID = @LineID
        AND fcw.Disabled IS NULL
        AND fcw.PolicyFormID IS NOT NULL
    ORDER BY 
        fcw.DocumentOrder, COALESCE(pf.FormName, 'Policy Form') ASC;
END