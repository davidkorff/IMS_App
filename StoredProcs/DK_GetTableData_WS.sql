GO
/****** Object:  StoredProcedure [dbo].[DK_GetTableData_WS]    Script Date: 7/8/2025 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[DK_GetTableData_WS]
    @TableName NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @SQL NVARCHAR(MAX);
    
    -- Simple and clean - just get top 100 rows from any table
    SET @SQL = N'SELECT TOP 100 * FROM ' + QUOTENAME(@TableName);
    
    EXEC sp_executesql @SQL;
END