GO
/****** Object:  StoredProcedure [dbo].[DK_GetStates_WS]    Script Date: 6/1/2025 12:02:17 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

  CREATE OR ALTER PROCEDURE [dbo].[DK_GetStates_WS]
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