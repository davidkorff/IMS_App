GO
/****** Object:  StoredProcedure [dbo].[DK_Submission_Search_WS]    Script Date: 5/31/2025 11:53:45 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[DK_Submission_Search_WS]
    @CustomerName NVARCHAR(100) = NULL,
    @ControlNo NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- If Control Number is provided, only search by that
    IF @ControlNo IS NOT NULL
    BEGIN
        SELECT 
            QuoteGUID,
            QuoteID,
            ControlNo,
            InsuredPolicyName as CustomerName,
            EndorsementComment,
            DateCreated
        FROM dbo.tblQuotes
        WHERE ControlNo = @ControlNo;
        RETURN;
    END

    -- If only Customer Name is provided, search by LIKE
    IF @CustomerName IS NOT NULL
    BEGIN
        SELECT 
            QuoteGUID,
            QuoteID,
            ControlNo,
            InsuredPolicyName as CustomerName,
            EndorsementComment,
            DateCreated
        FROM dbo.tblQuotes
        WHERE InsuredPolicyName LIKE '%' + @CustomerName + '%';
        RETURN;
    END

    -- If neither parameter is provided, return no results
    SELECT TOP 0 
        QuoteGUID,
        QuoteID,
        ControlNo,
        InsuredPolicyName as CustomerName,
        EndorsementComment,
        DateCreated
    FROM dbo.tblQuotes;
END

--exec DK_Submission_Search_WS @controlno=10000
