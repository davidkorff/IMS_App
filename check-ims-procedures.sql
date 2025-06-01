-- Check if our stored procedures exist
SELECT 
    ROUTINE_NAME,
    ROUTINE_TYPE,
    CREATED,
    LAST_ALTERED
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE'
AND ROUTINE_NAME IN (
    'DK_GetCompanies_WS',
    'DK_GetLines_WS', 
    'DK_GetStates_WS',
    'DK_GetCompanyLineForms_WS',
    'DK_GetFormContent',
    'DK_GetCompanyStateLines_WS'
)
ORDER BY ROUTINE_NAME;

-- Also check for any procedures with similar names
SELECT 
    ROUTINE_NAME,
    ROUTINE_TYPE
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE'
AND (
    ROUTINE_NAME LIKE '%Company%' OR
    ROUTINE_NAME LIKE '%Line%' OR
    ROUTINE_NAME LIKE '%State%' OR
    ROUTINE_NAME LIKE '%Form%'
)
ORDER BY ROUTINE_NAME;