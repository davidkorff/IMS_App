const xml2js = require('xml2js');
const authService = require('./authService');

class DataAccessService {
    constructor() {
        this.parser = new xml2js.Parser({ 
            explicitArray: false,
            valueProcessors: [xml2js.processors.parseNumbers],
            attrValueProcessors: [xml2js.processors.parseNumbers],
            explicitRoot: false
        });
    }

    async executeProc({ url, username, password, procedure, parameters = {} }) {
        console.log('Executing procedure:', procedure, 'with parameters:', parameters);

        try {
            // Get token through auth service
            const token = await authService.getToken(url, username, password);

            // Remove _WS suffix if it exists
            const baseProcName = procedure.endsWith('_WS') 
                ? procedure.slice(0, -3) 
                : procedure;

            // Format parameters for SOAP
            const formattedParams = [];
            Object.entries(parameters).forEach(([key, value]) => {
                const paramName = key.startsWith('@') ? key : `@${key}`;
                formattedParams.push(`<string>${paramName}</string>`);
                formattedParams.push(`<string>${value?.toString() ?? ''}</string>`);
            });

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
            <procedureName>${baseProcName}</procedureName>
            <parameters>
                ${formattedParams.join('\n                ')}
            </parameters>
        </ExecuteDataSet>
    </soap:Body>
</soap:Envelope>`;

            const response = await fetch(`${url}/DataAccess.asmx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IMSWebServices/DataAccess/ExecuteDataSet'
                },
                body: soapEnvelope
            });

            const responseText = await response.text();

            // Check for SOAP faults
            if (responseText.includes('soap:Fault')) {
                // Check if token expired
                if (responseText.includes('Token is not valid')) {
                    authService.clearToken(url);
                    // Retry once with new token
                    return this.executeProc({ url, username, password, procedure, parameters });
                }

                const paramMatch = responseText.match(/expects parameter '(@[^']+)'/);
                if (paramMatch) {
                    return { 
                        status: 'parameter_required',
                        parameter: paramMatch[1]
                    };
                }
                
                const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/s);
                throw new Error(faultMatch ? faultMatch[1].trim() : 'Unknown SOAP error');
            }

            // Extract and parse results
            const resultsMatch = responseText.match(/<ExecuteDataSetResult>(.*?)<\/ExecuteDataSetResult>/s);
            if (!resultsMatch) {
                throw new Error('Could not find results in response');
            }

            const decodedXML = resultsMatch[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');

            const result = await new Promise((resolve, reject) => {
                this.parser.parseString(decodedXML, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            // Ensure consistent format for single/multiple rows
            if (result && result.Table && !Array.isArray(result.Table)) {
                return { Table: [result.Table] };
            }

            return result;

        } catch (error) {
            console.error('Error executing procedure:', error);
            throw error;
        }
    }
}

module.exports = new DataAccessService(); 