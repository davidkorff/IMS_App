USE [InsuranceStrategiesTest]
GO
/****** Object:  StoredProcedure [dbo].[DK_SystemSettings_GetAll_WS]    Script Date: 6/11/2025 12:42:42 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- Author:      System
-- Create date: 2024
-- Description: Retrieves all system settings for display in web interface
-- =============================================
ALTER PROCEDURE [dbo].[DK_SystemSettings_GetAll_WS]
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
