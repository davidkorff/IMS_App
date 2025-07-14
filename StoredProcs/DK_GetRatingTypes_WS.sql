-- =============================================
-- Author:      IMS Application
-- Create date: 2025-01-08
-- Description: Get all rating types with RatingTypeID >= 4000
-- =============================================
CREATE PROCEDURE [dbo].[DK_GetRatingTypes_WS]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        RatingTypeID,
        RatingType,
        Hidden,
        MultiState,
        CanEditRaterPostBindResourceGuid,
        CanEditRaterPostIssueResourceGuid,
        ApplyAcrossDetails
    FROM lstRatingTypes
    WHERE RatingTypeID >= 4000
        AND Hidden = 0  -- Only show non-hidden rating types
    ORDER BY RatingType;
END