GO
/****** Object:  StoredProcedure [dbo].[DK_GetFormContent_WS]    Script Date: 5/31/2025 11:52:53 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

  CREATE OR ALTER PROCEDURE [dbo].[DK_GetFormContent_WS]
      @FormID INT
  AS
  BEGIN
      SET NOCOUNT ON;

      -- Check if the form has a direct PDF or needs to be fetched from template
      IF EXISTS (SELECT 1 FROM tblPolicyForms WHERE FormID = @FormID AND PDF IS NOT NULL AND
  DATALENGTH(PDF) > 0)
      BEGIN
          -- Direct PDF storage - return the PDF from tblPolicyForms
          SELECT
              pf.FormID,
              pf.FormName,
              pf.FormNumber,
              'PDF' AS Type,
              CAST(pf.PDF AS VARBINARY(MAX)) AS FormContent
          FROM
              tblPolicyForms pf
          WHERE
              pf.FormID = @FormID
      END
      ELSE IF EXISTS (SELECT 1 FROM tblPolicyForms WHERE FormID = @FormID AND TemplateID IS NOT NULL)
      BEGIN
          -- Template reference - fetch from tblDocumentTemplates
          SELECT
              pf.FormID,
              pf.FormName,
              pf.FormNumber,
              'PDF' AS Type,
              dt.Template AS FormContent
          FROM
              tblPolicyForms pf
              INNER JOIN tblDocumentTemplates dt ON pf.TemplateID = dt.TemplateID
          WHERE
              pf.FormID = @FormID
      END
      ELSE
      BEGIN
          -- No content found - return empty result with form info
          SELECT
              pf.FormID,
              pf.FormName,
              pf.FormNumber,
              'PDF' AS Type,
              NULL AS FormContent
          FROM
              tblPolicyForms pf
          WHERE
              pf.FormID = @FormID
      END
  END
