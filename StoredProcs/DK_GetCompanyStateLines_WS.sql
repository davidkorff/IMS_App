GO
/****** Object:  StoredProcedure [dbo].[DK_GetCompanyStateLines_WS]    Script Date: 5/31/2025 11:52:38 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

  CREATE OR ALTER PROCEDURE [dbo].[DK_GetCompanyStateLines_WS]
      @CompanyLocationGUID UNIQUEIDENTIFIER = NULL,
      @LineGUID UNIQUEIDENTIFIER = NULL,
      @StateID NVARCHAR(2) = NULL
  AS
  BEGIN
      SET NOCOUNT ON;

      -- Return valid company/line/state combinations
      SELECT DISTINCT
          cl.CompanyLineID,
          cl.CompanyLineGUID,
          cl.CompanyLocationGUID,
          cloc.LocationName AS CompanyName,
          cl.LineGUID,
          l.LineName,
          cl.StateID,
          s.State AS StateName,
          cl.CompanyLine AS Description,
          CAST(1 AS BIT) AS HasForms -- Placeholder to indicate forms are available
      FROM
          tblCompanyLines cl
      INNER JOIN
          tblCompanyLocations cloc ON cl.CompanyLocationGUID = cloc.CompanyLocationGUID
      INNER JOIN
          lstLines l ON cl.LineGUID = l.LineGUID
      INNER JOIN
          lstStates s ON cl.StateID = s.StateID
      WHERE
          cl.StatusID = 1  -- Active
          AND cl.Hidden = 0
          AND cloc.StatusID = 1
          AND cloc.Hidden = 0
          AND l.Inactive = 0
          AND s.IsUsState = 1
          AND (@CompanyLocationGUID IS NULL OR cl.CompanyLocationGUID = @CompanyLocationGUID)
          AND (@LineGUID IS NULL OR cl.LineGUID = @LineGUID)
          AND (@StateID IS NULL OR cl.StateID = @StateID)
      ORDER BY
          cloc.LocationName, l.LineName, s.State;
  END