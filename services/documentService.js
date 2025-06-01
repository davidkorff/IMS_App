const axios = require('axios');
const xml2js = require('xml2js');

class DocumentService {
    async getRatingSheet(url, token, quoteGuid) {
        console.log('DocumentService.getRatingSheet called with:', {
            url,
            token,
            quoteGuid
        });

        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <GetPolicyRatingSheet xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <QuoteGuid>${quoteGuid}</QuoteGuid>
        </GetPolicyRatingSheet>
    </soap:Body>
</soap:Envelope>`;

        try {
            const response = await axios.post(
                `${url}/DocumentFunctions.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://tempuri.org/IMSWebServices/DocumentFunctions/GetPolicyRatingSheet'
                    }
                }
            );

            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const result = await parser.parseStringPromise(response.data);
            return result['soap:Envelope']['soap:Body']['GetPolicyRatingSheetResponse']['GetPolicyRatingSheetResult'];

        } catch (error) {
            console.error('Error getting rating sheet:', error?.response?.data || error);
            throw error;
        }
    }

    async createBinderDocument(url, token, data) {
        return this._executeDocumentMethod(url, token, 'CreateBinderDocument', {
            QuoteGuid: data.quoteGuid,
            // Add other parameters as needed
        });
    }

    async createPolicyDocument(url, token, data) {
        return this._executeDocumentMethod(url, token, 'CreatePolicyDocument', {
            QuoteGuid: data.quoteGuid,
            // Add other parameters as needed
        });
    }

    async getDocumentFromFolder(url, token, data) {
        return this._executeDocumentMethod(url, token, 'GetDocumentFromFolder', {
            FolderId: data.folderId,
            // Add other parameters as needed
        });
    }

    async getDocumentFromStore(url, token, data) {
        return this._executeDocumentMethod(url, token, 'GetDocumentFromStore', {
            DocumentGuid: data.documentGuid,
            // Add other parameters as needed
        });
    }

    async insertAssociatedDocument(url, token, data) {
        return this._executeDocumentMethod(url, token, 'InsertAssociatedDocument', {
            QuoteGuid: data.quoteGuid,
            DocumentGuid: data.documentGuid,
            // Add other parameters as needed
        });
    }

    async applyPolicyForms(url, token, data) {
        return this._executeDocumentMethod(url, token, 'ApplyPolicyForms', {
            QuoteGuid: data.quoteGuid,
            // Add other parameters as needed
        });
    }

    async createPolicyTemplateDocument(url, token, templateId, quoteGuid = null) {
        return this._executeDocumentMethod(url, token, 'CreatePolicyTemplateDocument', {
            TemplateID: templateId,
            QuoteGuid: quoteGuid || ''
        });
    }

    async getFolderList(url, token, parentFolderId = 0) {
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <GetFolderList xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <parentFolderID>${parentFolderId}</parentFolderID>
        </GetFolderList>
    </soap:Body>
</soap:Envelope>`;

        try {
            console.log('Sending GetFolderList request with parentFolderId:', parentFolderId);
            
            const response = await axios.post(
                `${url}/DocumentFunctions.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://tempuri.org/IMSWebServices/DocumentFunctions/GetFolderList'
                    }
                }
            );

            // Parse the response
            const parser = new xml2js.Parser({ 
                explicitArray: false, 
                ignoreAttrs: false,
                mergeAttrs: true,
                explicitRoot: false
            });
            
            const result = await parser.parseStringPromise(response.data);
            
            // Extract the actual folder data from the diffgram
            const folderData = result['soap:Envelope']['soap:Body']
                ?.GetFolderListResponse
                ?.GetFolderListResult
                ?.['diffgr:diffgram']
                ?.FolderListSet
                ?.Table || [];

            // Convert to a simpler format
            const folders = Array.isArray(folderData) ? folderData : [folderData];
            
            console.log('Parsed folder list:', folders);
            
            return folders.map(folder => ({
                folderId: folder.FolderId,
                parentFolderId: folder.ParentFolderID,
                folderName: folder.FolderName,
                secureResourceGuid: folder.SecureResourceGuid
            })).filter(f => f.folderId); // Filter out empty entries

        } catch (error) {
            console.error('Error getting folder list:', error?.response?.data || error);
            throw error;
        }
    }

    async verifyFolder(url, token, folderId) {
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <VerifyFolder xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <folderID>${folderId}</folderID>
        </VerifyFolder>
    </soap:Body>
</soap:Envelope>`;

        try {
            console.log('Verifying folder:', folderId);
            
            const response = await axios.post(
                `${url}/DocumentFunctions.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://tempuri.org/IMSWebServices/DocumentFunctions/VerifyFolder'
                    }
                }
            );

            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const result = await parser.parseStringPromise(response.data);
            const exists = result['soap:Envelope']['soap:Body']['VerifyFolderResponse']['VerifyFolderResult'];
            
            console.log('Folder verification result:', exists);
            return exists === 'true' || exists === true;

        } catch (error) {
            console.error('Error verifying folder:', error?.response?.data || error);
            throw error;
        }
    }

    async _executeDocumentMethod(url, token, method, parameters) {
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <Token>${token}</Token>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <${method} xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            ${Object.entries(parameters)
                .map(([key, value]) => `<${key}>${value}</${key}>`)
                .join('\n            ')}
        </${method}>
    </soap:Body>
</soap:Envelope>`;

        try {
            const response = await axios.post(
                `${url}/DocumentFunctions.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': `http://tempuri.org/IMSWebServices/DocumentFunctions/${method}`
                    }
                }
            );

            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const result = await parser.parseStringPromise(response.data);
            return result['soap:Envelope']['soap:Body'][`${method}Response`][`${method}Result`];

        } catch (error) {
            console.error(`Error in ${method}:`, error?.response?.data || error);
            throw error;
        }
    }
}

module.exports = new DocumentService(); 