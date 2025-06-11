-- =============================================
-- System Settings Management Stored Procedures
-- Deploy these to your IMS SQL Server database
-- =============================================

-- Drop procedures if they exist
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DK_SystemSettings_GetAll_WS]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[DK_SystemSettings_GetAll_WS]
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DK_SystemSettings_Update_WS]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[DK_SystemSettings_Update_WS]
GO

-- Create procedure to get all system settings
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:      System
-- Create date: 2024
-- Description: Retrieves all system settings for display in web interface
-- =============================================
CREATE PROCEDURE [dbo].[DK_SystemSettings_GetAll_WS]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Retrieve all settings with proper data type handling
    SELECT 
        Setting,
        SettingValueString,
        SettingValueNumeric,
        SettingValueBool,
        -- Add display-friendly columns
        CASE 
            WHEN SettingValueBool IS NOT NULL THEN 'Boolean'
            WHEN SettingValueNumeric IS NOT NULL THEN 'Numeric'
            WHEN SettingValueString IS NOT NULL THEN 'String'
            ELSE 'Unknown'
        END AS DataType,
        CASE 
            WHEN SettingValueBool = 1 THEN 'True'
            WHEN SettingValueBool = 0 THEN 'False'
            ELSE NULL
        END AS BooleanDisplay
    FROM tblSystemSettings
    ORDER BY Setting;
END
GO

-- Create procedure to update system settings
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:      System
-- Create date: 2024
-- Description: Updates a system setting value
-- =============================================
CREATE PROCEDURE [dbo].[DK_SystemSettings_Update_WS]
    @Setting NVARCHAR(255),
    @SettingValueString NVARCHAR(MAX) = NULL,
    @SettingValueNumeric DECIMAL(18,6) = NULL,
    @SettingValueBool BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Update the setting
    UPDATE tblSystemSettings
    SET 
        SettingValueString = @SettingValueString,
        SettingValueNumeric = @SettingValueNumeric,
        SettingValueBool = @SettingValueBool
    WHERE Setting = @Setting;
    
    -- Return the updated row
    SELECT 
        Setting,
        SettingValueString,
        SettingValueNumeric,
        SettingValueBool,
        CASE 
            WHEN SettingValueBool IS NOT NULL THEN 'Boolean'
            WHEN SettingValueNumeric IS NOT NULL THEN 'Numeric'
            WHEN SettingValueString IS NOT NULL THEN 'String'
            ELSE 'Unknown'
        END AS DataType,
        CASE 
            WHEN SettingValueBool = 1 THEN 'True'
            WHEN SettingValueBool = 0 THEN 'False'
            ELSE NULL
        END AS BooleanDisplay
    FROM tblSystemSettings
    WHERE Setting = @Setting;
END
GO

PRINT 'System settings stored procedures created successfully';