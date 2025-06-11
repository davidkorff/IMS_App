-- Simplified System Settings Update Procedure
-- This version uses string parameters for all values to avoid type conversion issues

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DK_SystemSettings_Update_WS]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[DK_SystemSettings_Update_WS]
GO

CREATE PROCEDURE [dbo].[DK_SystemSettings_Update_WS]
    @Setting NVARCHAR(255),
    @SettingValueString NVARCHAR(MAX) = NULL,
    @SettingValueNumeric NVARCHAR(50) = NULL,
    @SettingValueBool NVARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Convert string parameters to proper types for update
    DECLARE @NumericValue DECIMAL(18,6) = NULL
    DECLARE @BoolValue BIT = NULL
    
    -- Convert numeric parameter if provided
    IF @SettingValueNumeric IS NOT NULL AND @SettingValueNumeric != ''
        SET @NumericValue = CAST(@SettingValueNumeric AS DECIMAL(18,6))
    
    -- Convert boolean parameter if provided  
    IF @SettingValueBool IS NOT NULL AND @SettingValueBool != ''
        SET @BoolValue = CASE 
            WHEN @SettingValueBool IN ('1', 'true', 'True', 'TRUE') THEN 1
            WHEN @SettingValueBool IN ('0', 'false', 'False', 'FALSE') THEN 0
            ELSE NULL
        END
    
    -- Update the setting
    UPDATE tblSystemSettings
    SET 
        SettingValueString = @SettingValueString,
        SettingValueNumeric = @NumericValue,
        SettingValueBool = @BoolValue
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

PRINT 'Simplified system settings update procedure created successfully';