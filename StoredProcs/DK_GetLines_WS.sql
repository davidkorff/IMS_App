GO
/****** Object:  StoredProcedure [dbo].[DK_GetLines_WS]    Script Date: 5/31/2025 11:53:01 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

  CREATE OR ALTER PROCEDURE [dbo].[DK_GetLines_WS]
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