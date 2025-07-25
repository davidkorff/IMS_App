const router = require('express').Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const reports = require('../config/reports');
const xml2js = require('xml2js');
const dataAccess = require('../services/dataAccess');
const authService = require('../services/authService');

// Add this helper function at the top of the file
function createSoapEnvelope(procedureName, parameters = []) {
    return `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                      xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                      xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Header>
                <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DataAccess">
                    <Token>${parameters.token || ''}</Token>
                    <Context>ImsMonitoring</Context>
                </TokenHeader>
            </soap:Header>
            <soap:Body>
                <ExecuteDataSet xmlns="http://tempuri.org/IMSWebServices/DataAccess">
                    <procedureName>${procedureName}</procedureName>
                    <parameters></parameters>
                </ExecuteDataSet>
            </soap:Body>
        </soap:Envelope>`;
}

// Get available reports
router.get('/available', auth, async (req, res) => {
    try {
        // Get instanceId from query params
        const instanceId = req.query.instanceId;
        
        if (!instanceId) {
            return res.status(400).json({ message: 'Instance ID is required' });
        }

        console.log('Fetching reports for instance:', instanceId);
        
        // Fetch reports from database for this instance
        const result = await pool.query(
            `SELECT 
                report_id as id,
                name,
                procedure_name as procedure,
                parameters,
                created_at
             FROM ims_reports 
             WHERE instance_id = $1
             ORDER BY created_at DESC`,
            [instanceId]
        );

        console.log('Query result:', result.rows);
        res.json(result.rows);
        
    } catch (err) {
        // Detailed error logging
        console.error('Database Error:', err);
        console.error('Error Stack:', err.stack);
        res.status(500).json({ 
            message: 'Failed to fetch reports', 
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Run a report with parameters
router.post('/run', auth, async (req, res) => {
    try {
        const { instanceId, reportId, parameters } = req.body;
        
        // Get instance and report details from DB
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const reportResult = await pool.query(
            'SELECT * FROM ims_reports WHERE report_id = $1',
            [reportId]
        );

        if (reportResult.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // Execute stored procedure with all parameters
        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: reportResult.rows[0].procedure_name,
            parameters
        });

        res.json(result);

    } catch (err) {
        console.error('Error running report:', err);
        res.status(500).json({ 
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Add this new test endpoint
router.get('/test', auth, async (req, res) => {
    console.log('GET /api/reports/test called');
    try {
        const testUrl = 'https://ws2.mgasystems.com/ims_origintest';
        
        // Step 1: Get Token
        console.log('Getting token...');
        const loginResponse = await fetch(`${testUrl}/logon.asmx/LoginIMSUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                userName: 'dkorff',
                tripleDESEncryptedPassword: 'kCeTLc2bxqOmG72ZBvMFkA=='
            })
        });

        const loginText = await loginResponse.text();
        console.log('\nLogin Response:', loginText);

        const tokenMatch = loginText.match(/<Token>(.*?)<\/Token>/);
        if (!tokenMatch) {
            throw new Error('Could not extract token');
        }
        const token = tokenMatch[1];
        console.log('\nExtracted Token:', token);

        // Step 2: Get Data using SOAP
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DataAccess">
            <Token>${token}</Token>
            <Context>ImsMonitoring</Context>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <ExecuteDataSet xmlns="http://tempuri.org/IMSWebServices/DataAccess">
            <procedureName>GetSubmissions</procedureName>
            <parameters></parameters>
        </ExecuteDataSet>
    </soap:Body>
</soap:Envelope>`;

        console.log('\nSOAP Request:', soapEnvelope);

        const dataResponse = await fetch(`${testUrl}/DataAccess.asmx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IMSWebServices/DataAccess/ExecuteDataSet'
            },
            body: soapEnvelope
        });

        const dataText = await dataResponse.text();
        console.log('Raw SOAP response:', dataText);
        
        // Extract the Results XML from the SOAP response
        const resultsMatch = dataText.match(/<ExecuteDataSetResult>(.*?)<\/ExecuteDataSetResult>/s);
        if (!resultsMatch) {
            console.log('No ExecuteDataSetResult found in response');
            throw new Error('Could not find results in response');
        }

        // Decode the HTML entities in the XML
        const decodedXML = resultsMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
        console.log('Decoded XML:', decodedXML);

        // Parse the XML to JSON
        const parser = new xml2js.Parser({ 
            explicitArray: false,
            valueProcessors: [xml2js.processors.parseNumbers],
            attrValueProcessors: [xml2js.processors.parseNumbers]
        });
        
        const result = await new Promise((resolve, reject) => {
            parser.parseString(decodedXML, (err, result) => {
                if (err) {
                    console.error('XML parsing error:', err);
                    reject(err);
                }
                else resolve(result);
            });
        });
        console.log('Parsed XML result:', result);

        // Extract just the Table entries and clean up the format
        let submissions;
        if (result && result.Results && result.Results.Table) {
            submissions = Array.isArray(result.Results.Table) 
                ? result.Results.Table 
                : [result.Results.Table];
            
            // Clean up the data
            submissions = submissions.map(sub => {
                const cleaned = {};
                for (let [key, value] of Object.entries(sub)) {
                    // Skip complex objects and empty values
                    if (typeof value !== 'object' && value !== '') {
                        cleaned[key] = value;
                    }
                }
                return cleaned;
            });
            
            console.log('Final cleaned submissions:', submissions);
        } else {
            console.log('No Table data found in result:', result);
            throw new Error('No data found in response');
        }

        // Send the cleaned up data to the frontend
        res.json(submissions);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test a report procedure to discover required parameters
router.post('/test', auth, async (req, res) => {
    try {
        const { instanceId, procedureName } = req.body;
        console.log('Testing procedure:', { instanceId, procedureName });

        // Get instance details
        const instanceResult = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instanceResult.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const instance = instanceResult.rows[0];

        // First, authenticate with LoginIMSUser
        const loginResponse = await fetch(`${instance.url}/logon.asmx/LoginIMSUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                userName: instance.username,
                tripleDESEncryptedPassword: instance.password
            })
        });

        const loginResult = await loginResponse.text();
        const tokenMatch = loginResult.match(/<Token>(.*?)<\/Token>/);
        if (!tokenMatch) {
            throw new Error('Could not extract token from login response');
        }
        const token = tokenMatch[1];

        // Create SOAP envelope with empty parameters to discover required ones
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DataAccess">
            <Token>${token}</Token>
            <Context>ImsMonitoring</Context>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <ExecuteDataSet xmlns="http://tempuri.org/IMSWebServices/DataAccess">
            <procedureName>${procedureName}</procedureName>
            <parameters></parameters>
        </ExecuteDataSet>
    </soap:Body>
</soap:Envelope>`;

        console.log('Sending SOAP request:', soapEnvelope);

        const response = await fetch(`${instance.url}/DataAccess.asmx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IMSWebServices/DataAccess/ExecuteDataSet'
            },
            body: soapEnvelope
        });

        const responseText = await response.text();
        console.log('SOAP Response:', responseText);

        // Check for parameter requirement in the error message
        if (responseText.includes('soap:Fault')) {
            const paramMatch = responseText.match(/expects parameter '(@[^']+)'/);
            if (paramMatch) {
                return res.json({ 
                    status: 'parameter_required',
                    parameter: paramMatch[1]
                });
            }
            
            // Extract error message from SOAP fault
            const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/s);
            throw new Error(faultMatch ? faultMatch[1].trim() : 'Unknown SOAP error');
        }

        // If we get here, the procedure executed successfully with no parameters
        res.json({ status: 'success' });

    } catch (err) {
        console.error('Error testing procedure:', err);
        res.status(500).json({ 
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Get reports for an instance
router.get('/:instanceId', auth, async (req, res) => {
    try {
        const reports = await pool.query(
            'SELECT * FROM ims_reports WHERE instance_id = $1',
            [req.params.instanceId]
        );
        res.json(reports.rows);
    } catch (err) {
        console.error('Error getting reports:', err);
        res.status(500).json({ message: 'Failed to get reports', error: err.message });
    }
});

// Save a new report
router.post('/', auth, async (req, res) => {
    try {
        const { instanceId, name, procedure_name, parameters } = req.body;
        
        const result = await pool.query(
            `INSERT INTO ims_reports (instance_id, name, procedure_name, parameters)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [instanceId, name, procedure_name, parameters]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error saving report:', err);
        res.status(500).json({ message: 'Failed to save report', error: err.message });
    }
});

// Query any IMS table dynamically
router.post('/query-table', auth, async (req, res) => {
    try {
        const { instanceId, tableName, limit = 100, offset = 0 } = req.body;
        
        if (!instanceId || !tableName) {
            return res.status(400).json({ message: 'Instance ID and table name are required' });
        }
        
        // Get instance credentials
        const instanceResult = await pool.query(
            'SELECT url, username, password FROM ims_instances WHERE instance_id = $1',
            [instanceId]
        );
        
        if (instanceResult.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }
        
        const instance = instanceResult.rows[0];
        
        try {
            // Use our simple stored procedure to query any table
            const result = await dataAccess.executeProc({
                url: instance.url,
                username: instance.username,
                password: instance.password,
                procedure: 'DK_GetTableData_WS',
                parameters: {
                    TableName: tableName
                }
            });
            
            res.json({
                success: true,
                tableName,
                data: result.Table || [],
                recordCount: result.Table ? result.Table.length : 0
            });
            
        } catch (imsError) {
            // If the generic procedure doesn't exist, try a table-specific approach
            // For lookup tables like lstBusinessTypes, there might be specific procedures
            if (imsError.message && imsError.message.includes('could not find stored procedure')) {
                // Since the main procedure failed, just return the error
                res.status(400).json({
                    success: false,
                    message: 'Unable to query table. The stored procedure might not exist in IMS.',
                    error: imsError.message,
                    hint: 'Deploy DK_GetTableData_WS.sql to your IMS database first.'
                });
            } else {
                throw imsError;
            }
        }
        
    } catch (err) {
        console.error('Error querying IMS table:', err);
        res.status(500).json({ 
            success: false,
            message: 'Failed to query IMS table', 
            error: err.message 
        });
    }
});


module.exports = router; 