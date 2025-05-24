const axios = require('axios');
const xml2js = require('xml2js');

class UnderwriterService {
    async getUnderwriters(url, token) {
        console.log('UnderwriterService.getUnderwriters called');

        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DataAccess">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <ExecuteCommand xmlns="http://tempuri.org/IMSWebServices/DataAccess">
            <procedureName>GetUnderwriters_WS</procedureName>
            <parameters>
                <string>@active</string>
                <string>1</string>
            </parameters>
        </ExecuteCommand>
    </soap:Body>
</soap:Envelope>`;

        try {
            const response = await axios.post(
                `${url}/dataaccess.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://tempuri.org/IMSWebServices/DataAccess/ExecuteCommand'
                    }
                }
            );

            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
            const result = await parser.parseStringPromise(response.data);

            const xmlData = result['soap:Envelope']['soap:Body']
                ['ExecuteCommandResponse']
                ['ExecuteCommandResult'];

            // Parse the XML string in the result
            const innerXml = await parser.parseStringPromise(xmlData);
            
            const underwriters = innerXml.Underwriters.Underwriter;
            return Array.isArray(underwriters) ? underwriters : [underwriters];

        } catch (error) {
            console.error('Error getting underwriters:', error?.response?.data || error);
            throw error;
        }
    }
}

module.exports = new UnderwriterService(); 