-- Fixed System Settings Update Procedure
-- This version properly handles NULL values to avoid overwriting other columns

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
    DECLARE @StringValue NVARCHAR(MAX) = NULL
    
    -- Handle string parameter - only update if explicitly provided (not empty string)
    IF @SettingValueString IS NOT NULL AND @SettingValueString != ''
        SET @StringValue = @SettingValueString
    
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
    
    -- Update only the columns that were actually provided
    -- Use conditional updates to preserve existing values in other columns
    UPDATE tblSystemSettings
    SET 
        SettingValueString = CASE 
            WHEN @SettingValueString IS NOT NULL THEN @StringValue
            ELSE SettingValueString 
        END,
        SettingValueNumeric = CASE 
            WHEN @SettingValueNumeric IS NOT NULL THEN @NumericValue
            ELSE SettingValueNumeric 
        END,
        SettingValueBool = CASE 
            WHEN @SettingValueBool IS NOT NULL THEN @BoolValue
            ELSE SettingValueBool 
        END
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

PRINT 'Fixed system settings update procedure created successfully';