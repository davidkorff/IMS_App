const axios = require('axios');
const xml2js = require('xml2js');
const authService = require('./authService');

class IMSService {
    constructor(instanceConfig = {}) {
        // Store instance configuration
        this.url = instanceConfig.url;
        this.username = instanceConfig.username;
        this.password = instanceConfig.password;
        this.token = null;
        this.userGuid = null;
    }
    
    async ensureAuthenticated() {
        if (!this.token) {
            const authData = await authService.authenticate(this.url, this.username, this.password);
            this.token = authData.token;
            this.userGuid = authData.userGuid;
        }
    }

    async makeSOAPRequest(service, method, body) {
        // Ensure we have a valid token before making the request
        await this.ensureAuthenticated();
        
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/${service}">
            <Token>${this.token}</Token>
            <Context>${this.userGuid}</Context>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        ${body}
    </soap:Body>
</soap:Envelope>`;

        try {
            // Map service names to endpoints
            const serviceEndpoints = {
                'Logon': 'logon',
                'QuoteFunctions': 'quotefunctions',
                'DocumentFunctions': 'documentfunctions',
                'InsuredFunctions': 'insuredfunctions',
                'ProducerFunctions': 'producerfunctions'
            };
            
            const serviceEndpoint = serviceEndpoints[service] || service.toLowerCase();
            const response = await axios.post(
                `${this.url}/${serviceEndpoint}.asmx`,
                soapEnvelope,
                {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': `"http://tempuri.org/IMSWebServices/${service}/${method}"`
                    }
                }
            );

            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);
            
            return result['soap:Envelope']['soap:Body'][`${method}Response`][`${method}Result`];
        } catch (error) {
            console.error(`IMS SOAP Error (${service}/${method}):`, error.response?.data || error.message);
            throw error;
        }
    }

    async addInsuredWithContact(insuredData, locationData, contactData) {
        const body = `
        <AddInsuredWithContact xmlns="http://tempuri.org/IMSWebServices/InsuredFunctions">
            <insured>
                <BusinessTypeID>${insuredData.BusinessTypeID}</BusinessTypeID>
                <Salutation>${insuredData.Salutation}</Salutation>
                <FirstName>${insuredData.FirstName}</FirstName>
                <MiddleName>${insuredData.MiddleName}</MiddleName>
                <LastName>${insuredData.LastName}</LastName>
                <CorporationName>${insuredData.CorporationName}</CorporationName>
                <NameOnPolicy>${insuredData.NameOnPolicy}</NameOnPolicy>
                <DBA>${insuredData.DBA}</DBA>
                <FEIN>${insuredData.FEIN}</FEIN>
                <SSN>${insuredData.SSN}</SSN>
                ${insuredData.DateOfBirth ? `<DateOfBirth>${insuredData.DateOfBirth}</DateOfBirth>` : ''}
                <Office>${insuredData.Office}</Office>
            </insured>
            <location>
                <LocationName>${locationData.LocationName}</LocationName>
                <LocationTypeID>${locationData.LocationTypeID}</LocationTypeID>
                <Address1>${locationData.Address1}</Address1>
                <Address2>${locationData.Address2}</Address2>
                <City>${locationData.City}</City>
                <State>${locationData.State}</State>
                <Zip>${locationData.Zip}</Zip>
                <Phone>${locationData.Phone}</Phone>
                <Email>${locationData.Email}</Email>
                <ISOCountryCode>${locationData.ISOCountryCode}</ISOCountryCode>
                <DeliveryMethodID>${locationData.DeliveryMethodID}</DeliveryMethodID>
            </location>
            <contact>
                <DeliveryMethodID>${contactData.DeliveryMethodID}</DeliveryMethodID>
                <Salutation>${contactData.Salutation}</Salutation>
                <FirstName>${contactData.FirstName}</FirstName>
                <LastName>${contactData.LastName}</LastName>
                <Phone>${contactData.Phone}</Phone>
                <Email>${contactData.Email}</Email>
                <Address1>${contactData.Address1}</Address1>
                <Address2>${contactData.Address2}</Address2>
                <City>${contactData.City}</City>
                <State>${contactData.State}</State>
                <Zip>${contactData.Zip}</Zip>
                <ISOCountryCode>${contactData.ISOCountryCode || 'US'}</ISOCountryCode>
            </contact>
        </AddInsuredWithContact>`;

        return await this.makeSOAPRequest('InsuredFunctions', 'AddInsuredWithContact', body);
    }

    async addQuoteWithSubmission(submissionData, quoteData) {
        const body = `
        <AddQuoteWithSubmission xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <submission>
                <Insured>${submissionData.Insured}</Insured>
                <ProducerContact>${submissionData.ProducerContact}</ProducerContact>
                <Underwriter>${submissionData.Underwriter}</Underwriter>
                <SubmissionDate>${submissionData.SubmissionDate}</SubmissionDate>
                <ProducerLocation>${submissionData.ProducerLocation}</ProducerLocation>
            </submission>
            <quote>
                <QuotingLocation>${quoteData.QuotingLocation}</QuotingLocation>
                <IssuingLocation>${quoteData.IssuingLocation}</IssuingLocation>
                <CompanyLocation>${quoteData.CompanyLocation}</CompanyLocation>
                <Line>${quoteData.Line}</Line>
                <StateID>${quoteData.StateID}</StateID>
                <ProducerContact>${quoteData.ProducerContact}</ProducerContact>
                <QuoteStatusID>${quoteData.QuoteStatusID}</QuoteStatusID>
                <Effective>${quoteData.Effective}</Effective>
                <Expiration>${quoteData.Expiration}</Expiration>
                <BillingTypeID>${quoteData.BillingTypeID}</BillingTypeID>
                ${quoteData.QuoteDetail ? `<QuoteDetail>
                    <CompanyCommission>${quoteData.QuoteDetail.CompanyCommission}</CompanyCommission>
                    <ProducerCommission>${quoteData.QuoteDetail.ProducerCommission}</ProducerCommission>
                    <TermsOfPayment>${quoteData.QuoteDetail.TermsOfPayment}</TermsOfPayment>
                    <RaterID>${quoteData.QuoteDetail.RaterID}</RaterID>
                </QuoteDetail>` : ''}
                <PolicyTypeID>${quoteData.PolicyTypeID}</PolicyTypeID>
                <InsuredBusinessTypeID>${quoteData.InsuredBusinessTypeID}</InsuredBusinessTypeID>
                <RiskInformation>
                    <PolicyName>${quoteData.RiskInformation.PolicyName}</PolicyName>
                    <CorporationName>${quoteData.RiskInformation.CorporationName}</CorporationName>
                    <DBA>${quoteData.RiskInformation.DBA}</DBA>
                    <Salutation>${quoteData.RiskInformation.Salutation}</Salutation>
                    <FirstName>${quoteData.RiskInformation.FirstName}</FirstName>
                    <MiddleName>${quoteData.RiskInformation.MiddleName}</MiddleName>
                    <LastName>${quoteData.RiskInformation.LastName}</LastName>
                    <SSN>${quoteData.RiskInformation.SSN}</SSN>
                    <FEIN>${quoteData.RiskInformation.FEIN}</FEIN>
                    <Address1>${quoteData.RiskInformation.Address1}</Address1>
                    <Address2>${quoteData.RiskInformation.Address2}</Address2>
                    <City>${quoteData.RiskInformation.City}</City>
                    <State>${quoteData.RiskInformation.State}</State>
                    <ZipCode>${quoteData.RiskInformation.ZipCode}</ZipCode>
                    <Phone>${quoteData.RiskInformation.Phone}</Phone>
                    <BusinessType>${quoteData.RiskInformation.BusinessType}</BusinessType>
                </RiskInformation>
            </quote>
        </AddQuoteWithSubmission>`;

        const result = await this.makeSOAPRequest('QuoteFunctions', 'AddQuoteWithSubmission', body);
        
        // Parse the result to get both submission and quote GUIDs
        // The result is typically the quote GUID, but we need to handle both
        return {
            submissionGuid: result, // This might need adjustment based on actual response
            quoteGuid: result
        };
    }

    async getControlNumber(quoteGuid) {
        const body = `
        <GetControlNumber xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <quoteGuid>${quoteGuid}</quoteGuid>
        </GetControlNumber>`;

        return await this.makeSOAPRequest('QuoteFunctions', 'GetControlNumber', body);
    }

    async autoAddQuoteDetails(quoteGuid, recalculateCommissions = false) {
        const body = `
        <AutoAddQuoteDetails xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <QuoteGuid>${quoteGuid}</QuoteGuid>
            <RecalculateCommissions>${recalculateCommissions ? 'true' : 'false'}</RecalculateCommissions>
        </AutoAddQuoteDetails>`;

        try {
            await this.makeSOAPRequest('QuoteFunctions', 'AutoAddQuoteDetails', body);
            return true;
        } catch (error) {
            console.error('AutoAddQuoteDetails error:', error);
            throw error;
        }
    }
    
    async autoAddQuoteOptions(quoteGuid) {
        const body = `
        <AutoAddQuoteOptions xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <quoteGuid>${quoteGuid}</quoteGuid>
        </AutoAddQuoteOptions>`;

        const result = await this.makeSOAPRequest('QuoteFunctions', 'AutoAddQuoteOptions', body);
        
        console.log('AutoAddQuoteOptions raw result:', JSON.stringify(result, null, 2));
        
        // The result structure might vary - let's check all possibilities
        if (result) {
            // Check if it's a simple success response
            if (result === '' || result === true || result === 'true' || result === '0') {
                console.log('AutoAddQuoteOptions returned minimal response - options may have been created');
                // Options were likely created but not returned in the response
                // We would need a separate call to get them
                return [];
            }
            
            // Check for AutoAddQuoteOptionsResult
            if (result.AutoAddQuoteOptionsResult !== undefined) {
                // Sometimes it returns '0' to indicate success with no details
                if (result.AutoAddQuoteOptionsResult === '0' || result.AutoAddQuoteOptionsResult === 0) {
                    console.log('AutoAddQuoteOptions returned 0 - this usually means success');
                    return [];
                }
                
                // Check for QuoteOption within result
                const optionData = result.AutoAddQuoteOptionsResult.QuoteOption || 
                                 result.AutoAddQuoteOptionsResult;
                                 
                if (optionData && optionData !== '0') {
                    const options = Array.isArray(optionData) ? optionData : [optionData];
                    const validOptions = options.filter(opt => opt && opt.QuoteOptionGUID);
                    console.log(`Found ${validOptions.length} quote options in response`);
                    return validOptions;
                }
            }
            
            // Check if options are at root level
            if (result.QuoteOption) {
                console.log('QuoteOption found at root level:', JSON.stringify(result.QuoteOption, null, 2));
                const options = Array.isArray(result.QuoteOption) ? result.QuoteOption : [result.QuoteOption];
                console.log('Options array:', options);
                console.log('First option keys:', options[0] ? Object.keys(options[0]) : 'no options');
                
                // Return the options with normalized field names
                const normalizedOptions = options.map(opt => {
                    if (!opt) return null;
                    const normalized = {
                        QuoteOptionGUID: opt.QuoteOptionGuid || opt.QuoteOptionGUID,
                        LineGuid: opt.LineGuid,
                        LineName: opt.LineName,
                        CompanyLocation: opt.CompanyLocation,
                        ...opt
                    };
                    console.log('Normalized option:', normalized);
                    return normalized;
                }).filter(normalizedOpt => normalizedOpt && normalizedOpt.QuoteOptionGUID);
                
                console.log(`Found ${normalizedOptions.length} valid quote options at root level`);
                return normalizedOptions;
            }
        }
        
        console.log('No quote options found in response - they may exist in IMS but were not returned');
        return [];
    }

    async importExcelRater(quoteGuid, fileBytes, fileName, raterID, factorSetGuid, applyFees) {
        const body = `
        <ImportExcelRater xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <QuoteGuid>${quoteGuid}</QuoteGuid>
            <FileBytes>${fileBytes}</FileBytes>
            <FileName>${fileName}</FileName>
            <RaterID>${raterID || 0}</RaterID>
            ${factorSetGuid ? `<FactorSetGuid>${factorSetGuid}</FactorSetGuid>` : `<FactorSetGuid>00000000-0000-0000-0000-000000000000</FactorSetGuid>`}
            <ApplyFees>${applyFees ? 'true' : 'false'}</ApplyFees>
        </ImportExcelRater>`;

        try {
            const result = await this.makeSOAPRequest('QuoteFunctions', 'ImportExcelRater', body);
            
            console.log('ImportExcelRater raw result:', JSON.stringify(result, null, 2));
            
            // The result might be nested differently
            const importResult = result || {};
            
            // Parse success/failure
            const success = importResult.Success === 'true' || importResult.Success === true;
            
            // Ensure Premiums is an array
            let premiums = [];
            if (importResult.Premiums) {
                if (importResult.Premiums.OptionResult) {
                    premiums = Array.isArray(importResult.Premiums.OptionResult)
                        ? importResult.Premiums.OptionResult
                        : [importResult.Premiums.OptionResult];
                } else if (Array.isArray(importResult.Premiums)) {
                    premiums = importResult.Premiums;
                }
            }
            
            return {
                Success: success,
                ErrorMessage: importResult.ErrorMessage || '',
                Premiums: premiums
            };
        } catch (error) {
            console.error('ImportExcelRater error:', error);
            return { 
                Success: false, 
                ErrorMessage: error.message || 'Import failed',
                Premiums: []
            };
        }
    }

    async saveRatingSheet(quoteGuid, raterId, fileBytes, fileName) {
        const body = `
        <SaveRatingSheet xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <quoteGuid>${quoteGuid}</quoteGuid>
            <raterId>${raterId || 0}</raterId>
            <fileBytes>${fileBytes}</fileBytes>
            <fileName>${fileName}</fileName>
        </SaveRatingSheet>`;

        // Note: DocumentFunctions is a different service endpoint
        return await this.makeSOAPRequest('DocumentFunctions', 'SaveRatingSheet', body);
    }

    async addPremium(quoteOptionGuid, premium, officeID, chargeCode) {
        const body = `
        <AddPremium xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <quoteOptionGuid>${quoteOptionGuid}</quoteOptionGuid>
            <premium>${premium.toFixed(2)}</premium>
            <officeID>${officeID || -1}</officeID>
            <chargeCode>${chargeCode || 1}</chargeCode>
        </AddPremium>`;

        return await this.makeSOAPRequest('QuoteFunctions', 'AddPremium', body);
    }

    async searchProducerByEmail(email) {
        const body = `
        <ProducerSearch xmlns="http://tempuri.org/IMSWebServices/ProducerFunctions">
            <searchString>${email}</searchString>
            <startWith>false</startWith>
        </ProducerSearch>`;

        try {
            const result = await this.makeSOAPRequest('ProducerFunctions', 'ProducerSearch', body);
            
            // Handle the response - it might be an array or single object
            if (result && result.ProducerLocation) {
                return Array.isArray(result.ProducerLocation) 
                    ? result.ProducerLocation 
                    : [result.ProducerLocation];
            }
            
            return [];
        } catch (error) {
            console.error('Error searching producer:', error);
            return [];
        }
    }

    async getPolicyInformation(quoteGuid) {
        const body = `
        <GetPolicyInformation xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <quoteGuid>${quoteGuid}</quoteGuid>
        </GetPolicyInformation>`;

        try {
            const result = await this.makeSOAPRequest('QuoteFunctions', 'GetPolicyInformation', body);
            console.log('GetPolicyInformation raw result:', result);
            
            // The result is typically XML string that needs to be parsed
            if (typeof result === 'string' && result.includes('<')) {
                const parser = new xml2js.Parser({ explicitArray: false });
                const parsedResult = await parser.parseStringPromise(result);
                console.log('GetPolicyInformation parsed result:', JSON.stringify(parsedResult, null, 2));
                return parsedResult;
            }
            
            return result;
        } catch (error) {
            console.error('GetPolicyInformation error:', error);
            throw error;
        }
    }

}

module.exports = IMSService;