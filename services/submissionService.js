const axios = require('axios');
const xml2js = require('xml2js');

class SubmissionService {
    async addSubmission(url, token, data) {
        console.log('SubmissionService.addSubmission called with:', {
            url,
            insuredGuid: data.insuredGuid
        });

        const formattedDate = new Date().toISOString().split('.')[0]; // Remove milliseconds

        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <AddSubmission xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <submission>
                <Insured>${data.insuredGuid}</Insured>
                <ProducerContact>${data.producerContactGuid}</ProducerContact>
                <Underwriter>${data.underwriterGuid}</Underwriter>
                <SubmissionDate>${formattedDate}</SubmissionDate>
            </submission>
        </AddSubmission>
    </soap:Body>
</soap:Envelope>`;

        try {
            const response = await axios.post(
                `${url}/quotefunctions.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://tempuri.org/IMSWebServices/QuoteFunctions/AddSubmission'
                    }
                }
            );

            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const result = await parser.parseStringPromise(response.data);
            const submissionGuid = result['soap:Envelope']['soap:Body']
                ['AddSubmissionResponse']
                ['AddSubmissionResult'];

            console.log('Created submission with GUID:', submissionGuid);
            return { submissionGuid };

        } catch (error) {
            console.error('Error creating submission:', error?.response?.data || error);
            throw error;
        }
    }
}

module.exports = new SubmissionService(); 