const router = require('express').Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const reports = require('../config/reports');
const xml2js = require('xml2js');

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
    res.json(reports);
});

// Run a report
router.post('/run', auth, async (req, res) => {
    console.log('POST /api/reports/run called');
    console.log('Running report');
    try {
        const { instanceId, reportId } = req.body;
        
        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const report = reports.find(r => r.id === reportId);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // First, authenticate with LoginIMSUser
        console.log('Authenticating with IMS...');
        const loginResponse = await fetch(`${instance.rows[0].url}/logon.asmx/LoginIMSUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                userName: instance.rows[0].username,
                tripleDESEncryptedPassword: instance.rows[0].password
            })
        });

        const loginResult = await loginResponse.text();
        console.log('Login response:', loginResult);

        const tokenMatch = loginResult.match(/<Token>(.*?)<\/Token>/);
        if (!tokenMatch) {
            throw new Error('Could not extract token from login response');
        }
        const token = tokenMatch[1];
        
        // Create SOAP envelope for the report request
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
            <procedureName>GetSubmissions</procedureName>
            <parameters></parameters>
        </ExecuteDataSet>
    </soap:Body>
</soap:Envelope>`;

        console.log('\n=== SOAP Request XML ===\n', soapEnvelope, '\n=====================\n');

        // Make the SOAP request
        const response = await fetch(`${instance.rows[0].url}/DataAccess.asmx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IMSWebServices/DataAccess/ExecuteDataSet'
            },
            body: soapEnvelope
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('\n=== SOAP Response ===\n', responseText, '\n==================\n');

        // Send the raw XML response back to the client
        res.send(responseText);

    } catch (err) {
        console.error('Error running report:', err);
        res.status(500).json({ 
            message: 'Failed to run report',
            error: err.message 
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

// Test a report procedure
router.post('/test', auth, async (req, res) => {
    try {
        const { instanceId, procedureName } = req.body;
        
        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // First, authenticate with LoginIMSUser
        console.log('Authenticating with IMS...');
        const loginResponse = await fetch(`${instance.rows[0].url}/logon.asmx/LoginIMSUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                userName: instance.rows[0].username,
                tripleDESEncryptedPassword: instance.rows[0].password
            })
        });

        const loginResult = await loginResponse.text();
        console.log('Login response:', loginResult);

        const tokenMatch = loginResult.match(/<Token>(.*?)<\/Token>/);
        if (!tokenMatch) {
            throw new Error('Could not extract token from login response');
        }
        const token = tokenMatch[1];

        // Try to execute the procedure without parameters to see what's required
        const response = await fetch(`${instance.rows[0].url}/DataAccess.asmx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IMSWebServices/DataAccess/ExecuteDataSet'
            },
            body: createSoapEnvelope(procedureName, { token })
        });

        const responseText = await response.text();
        console.log('Test response:', responseText);

        res.send(responseText);

    } catch (err) {
        console.error('Error testing report:', err);
        res.status(500).json({ message: 'Failed to test report', error: err.message });
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

module.exports = router; 