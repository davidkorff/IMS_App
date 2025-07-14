USE [InsuranceStrategiesTest]
GO
/****** Object: StoredProcedure [dbo].[ExcelRating_RateOption4_WS] Script Date: 7/14/2025 12:03:56 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
ExcelRating_RateOption takes the premium options marked in the Excel Rating Admin. 
We then pass it to UpdatePremiumHistoricV3.
UpdatePremiumHistoricV3 should be the model for base rating and used whenever possible to ensure uniform rating
*/
ALTER PROCEDURE [dbo].[ExcelRating_RateOption4_WS]
    @quoteGuid UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    --DECLARE @quoteGuid UNIQUEIDENTIFIER = '304DDF15-E441-4B59-B888-99398C21BE17'
    
    DECLARE @quoteOptionGuid UNIQUEIDENTIFIER
    
    IF dbo.IsQuoteBound(@quoteGuid) = 1
    BEGIN
        RAISERROR('Cannot rate a bound transaction using ExcelRating_RateOption4', 16, 123)
        RETURN;
    END
    
    -- Get the quote option guid and verify there's only one option for this quote
    SELECT @quoteOptionGuid = QuoteOptionGUID
    FROM dbo.tblQuoteOptions
    WHERE QuoteGUID = @quoteGuid
    
    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR('No quote option found for the specified quote', 16, 123)
        RETURN;
    END
    
    IF EXISTS(SELECT 1 FROM dbo.tblQuoteOptions WHERE QuoteGUID = @quoteGuid GROUP BY QuoteGUID HAVING COUNT(*) > 1)
    BEGIN
        RAISERROR('Multi-option rating not supported by ExcelRating_RateOption4', 16, 123)
        RETURN;
    END
    
    DECLARE @premiumField NVARCHAR(200),
            @premiumOption VARCHAR(4),
            @dataTable NVARCHAR(200),
            @FactorSetGuid UNIQUEIDENTIFIER,
            @RoundPrems BIT = 1,
            @IncLeapDayInProrataCalc BIT = 0,
            @DisableAllProrataCalc BIT = 0,
            @AllowZeroPrem BIT = 0;
    
    SELECT @dataTable = ter.DatabaseTableName,
           @FactorSetGuid = tqd.FactorSetGUID,
           @RoundPrems = tefs.RoundPremiums,
           @IncLeapDayInProrataCalc = tefs.IncludeLeapDayInProrataCalc,
           @DisableAllProrataCalc = tefs.DisableAllProrataCalculation,
           @AllowZeroPrem = tefs.AllowZeroPremium
    FROM dbo.tblQuoteOptions tqo
        -- Only supports mono-line.
        JOIN dbo.tblQuoteDetails tqd ON tqo.QuoteGUID = tqd.QuoteGuid
        JOIN dbo.tblExcelRating_Raters ter ON ter.RatingTypeId = tqd.RaterID
        JOIN dbo.tblExcelRating_FactorSets tefs ON tefs.FactorSetGuid = tqd.FactorSetGUID
    WHERE tqo.QuoteOptionGUID = @quoteOptionGuid
    
    DECLARE premiumOptionCursor CURSOR LOCAL FAST_FORWARD READ_ONLY FOR
        SELECT DatabaseField, PremiumOption
        FROM dbo.tblExcelRating_Mappings
        WHERE ExcelFactorSetId = @FactorSetGuid
              AND PremiumOption IS NOT NULL
    
    OPEN premiumOptionCursor
    
    FETCH NEXT FROM premiumOptionCursor INTO @premiumField, @premiumOption
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC [dbo].[UpdatePremiumHistoricV3]
            @quoteOptionGuid = @quoteOptionGuid,
            @RawPremiumHistoryTable = @dataTable,
            @PremiumField = @premiumField,
            @chargeID = @premiumOption,
            @RoundPremiums = @RoundPrems,
            @includeLeapDayInProrataCalc = @IncLeapDayInProrataCalc,
            @disableAllProrataCalculation = @DisableAllProrataCalc,
            @AllowZeroPremium = @AllowZeroPrem
        
        FETCH NEXT FROM premiumOptionCursor INTO @premiumField, @premiumOption
    END
    
    CLOSE premiumOptionCursor
    DEALLOCATE premiumOptionCursor
    
END