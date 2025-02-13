console.log('Loading insured router - START');

const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/auth');
const pool = require('../../../config/db');
const authService = require('../../../services/authService');

router.post('/', auth, async (req, res) => {
    console.log('Insured creation request received:', req.body);
    try {
        const { instanceId, insuredName } = req.body;
        
        if (!instanceId || !insuredName) {
            console.log('Missing required fields:', { instanceId, insuredName });
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Get instance details directly from database
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            console.log('Instance not found:', instanceId);
            return res.status(404).json({ message: 'Instance not found' });
        }

        const instanceDetails = instance.rows[0];
        // Remove trailing slash if it exists
        const baseUrl = instanceDetails.url.replace(/\/$/, '');
        console.log('Instance found:', { url: baseUrl });

        // Get IMS token using authService
        const token = await authService.getToken(
            baseUrl,
            instanceDetails.username,
            instanceDetails.password
        );
        console.log('Got IMS token:', token.substring(0, 10) + '...');

        // Create SOAP envelope for CreateInsured
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <AuthenticationHeader xmlns="http://tempuri.org/IMSWebServices/Insured">
            <Token>${token}</Token>
        </AuthenticationHeader>
    </soap:Header>
    <soap:Body>
        <AddInsuredWithLocation xmlns="http://tempuri.org/IMSWebServices/Insured">
            <insured>
                <InsuredName>${insuredName}</InsuredName>
                <LocationName>${insuredName}</LocationName>
                <Address1>123 Main St</Address1>
                <City>Test City</City>
                <State>NY</State>
                <Zip>12345</Zip>
                <ISOCountryCode>USA</ISOCountryCode>
                <DeliveryMethodID>1</DeliveryMethodID>
                <LocationTypeID>1</LocationTypeID>
            </insured>
        </AddInsuredWithLocation>
    </soap:Body>
</soap:Envelope>`;

        const soapUrl = `${baseUrl}/insuredfunctions.asmx`;
        console.log('Making SOAP request to:', soapUrl);
        console.log('SOAP envelope:', soapEnvelope);

        const response = await fetch(soapUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IMSWebServices/Insured/AddInsuredWithLocation'
            },
            body: soapEnvelope
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SOAP error response:', errorText);
            throw new Error(`SOAP request failed: ${response.statusText} (${response.status})`);
        }

        const responseText = await response.text();
        console.log('SOAP response:', responseText);
        
        // Extract insured GUID from SOAP response
        const guidMatch = responseText.match(/<AddInsuredWithLocationResult>(.*?)<\/AddInsuredWithLocationResult>/);
        if (!guidMatch) {
            throw new Error('Could not extract insured GUID from response');
        }

        const insuredGuid = guidMatch[1];
        res.json({
            insuredGuid: insuredGuid,
            message: 'Insured created successfully'
        });

    } catch (err) {
        console.error('Insured creation error:', err);
        res.status(500).json({ 
            message: 'Error creating insured',
            details: err.message 
        });
    }
});

console.log('Loading insured router - END');

module.exports = router; 