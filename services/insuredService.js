const axios = require('axios');
const xml2js = require('xml2js');

class InsuredService {
    async addInsuredWithLocation(url, token, data) {
        console.log('InsuredService.addInsuredWithLocation called with:', {
            url,
            insuredName: data.insuredName,
            businessType: data.businessType,
            address: data.address1,
            city: data.city,
            state: data.state,
            zip: data.zip
        });

        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/InsuredFunctions">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <AddInsuredWithLocation xmlns="http://tempuri.org/IMSWebServices/InsuredFunctions">
            <insured>
                <BusinessTypeID>${data.businessType || 4}</BusinessTypeID>
                <FirstName>${data.insuredName}</FirstName>
                <LastName></LastName>
                <NameOnPolicy>${data.insuredName}</NameOnPolicy>
            </insured>
            <location>
                <LocationName>Main Office</LocationName>
                <Address1>${data.address1 || ''}</Address1>
                <City>${data.city || ''}</City>
                <State>${data.state || 'NY'}</State>
                <Zip>${data.zip || ''}</Zip>
                <ISOCountryCode>USA</ISOCountryCode>
                <DeliveryMethodID>${data.deliveryMethod || 1}</DeliveryMethodID>
                <LocationTypeID>1</LocationTypeID>
                <Email>${data.email || ''}</Email>
            </location>
        </AddInsuredWithLocation>
    </soap:Body>
</soap:Envelope>`;

        try {
            const response = await axios.post(
                `${url}/insuredfunctions.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://tempuri.org/IMSWebServices/InsuredFunctions/AddInsuredWithLocation'
                    }
                }
            );

            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const result = await parser.parseStringPromise(response.data);
            const insuredGuid = result['soap:Envelope']['soap:Body']
                ['AddInsuredWithLocationResponse']
                ['AddInsuredWithLocationResult'];

            console.log('Created insured with GUID:', insuredGuid);
            return { insuredGuid };

        } catch (error) {
            console.error('Error creating insured:', error?.response?.data || error);
            throw error;
        }
    }

    async getBusinessTypes(url, token) {
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/InsuredFunctions">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <GetInsuredBusinessTypes xmlns="http://tempuri.org/IMSWebServices/InsuredFunctions" />
    </soap:Body>
</soap:Envelope>`;

        try {
            const response = await axios.post(
                `${url}/insuredfunctions.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://tempuri.org/IMSWebServices/InsuredFunctions/GetInsuredBusinessTypes'
                    }
                }
            );

            const parser = new xml2js.Parser({ 
                explicitArray: false, 
                ignoreAttrs: false,
                mergeAttrs: true
            });
            
            const result = await parser.parseStringPromise(response.data);
            const businessTypes = result['soap:Envelope']['soap:Body']
                ['GetInsuredBusinessTypesResponse']
                ['GetInsuredBusinessTypesResult']
                ['diffgr:diffgram']
                ['NewDataSet']
                ['Table'] || [];

            return Array.isArray(businessTypes) ? businessTypes : [businessTypes];

        } catch (error) {
            console.error('Error getting business types:', error?.response?.data || error);
            throw error;
        }
    }
}

module.exports = new InsuredService(); 