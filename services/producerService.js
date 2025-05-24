const axios = require('axios');
const xml2js = require('xml2js');

class ProducerService {
    async getProducers(url, token) {
        console.log('ProducerService.getProducers called');

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
            <procedureName>GetProducers_WS</procedureName>
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
            
            const producers = innerXml.Producers.Producer;
            return Array.isArray(producers) ? producers : [producers];

        } catch (error) {
            console.error('Error getting producers:', error?.response?.data || error);
            throw error;
        }
    }
}

module.exports = new ProducerService(); 