-- Check what line GUIDs look like in your IMS database
SELECT TOP 10
    LineID,
    LineGUID,
    LineName
FROM lstLines
WHERE Inactive = 0
ORDER BY LineName;

-- Check company location GUIDs
SELECT TOP 10
    CompanyLocationGUID,
    LocationName
FROM tblCompanyLocations
WHERE StatusID = 1
ORDER BY LocationName;

-- Check the relationship between companies and lines
SELECT TOP 10
    cl.CompanyLineGUID,
    cl.CompanyLocationGUID,
    cl.LineGUID,
    l.LineName,
    c.LocationName
FROM tblCompanyLines cl
INNER JOIN lstLines l ON cl.LineGUID = l.LineGUID
INNER JOIN tblCompanyLocations c ON cl.CompanyLocationGUID = c.CompanyLocationGUID
WHERE l.Inactive = 0
ORDER BY l.LineName;