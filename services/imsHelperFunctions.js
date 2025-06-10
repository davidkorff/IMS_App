const authService = require('./authService');
const dataAccessService = require('./dataAccess');
const insuredService = require('./insuredService');
const submissionService = require('./submissionService');
const producerService = require('./producerService');
const documentService = require('./documentService');

class IMSHelperFunctions {
    constructor(instanceConfig) {
        this.url = instanceConfig.url;
        this.username = instanceConfig.username;
        this.password = instanceConfig.password;
    }

    // ===================
    // AUTHENTICATION
    // ===================
    
    async login() {
        // Get authentication token and user GUID
        const token = await authService.getToken(this.url, this.username, this.password);
        const userGuid = await authService.getUserGuid(this.url, this.username, this.password);
        return { token, userGuid };
    }

    // ===================
    // DATA ACCESS
    // ===================
    
    async executeStoredProcedure(procedureName, parameters = {}) {
        // Execute stored procedure using DataAccess service
        // Note: Procedure name should include _WS suffix
        const result = await dataAccessService.executeProc({
            url: this.url,
            username: this.username,
            password: this.password,
            procedure: procedureName.endsWith('_WS') ? procedureName : procedureName + '_WS',
            parameters: parameters
        });
        
        return result;
    }

    async executeWebMethod(webservice, method, parameters = {}) {
        // Execute any IMS web method
        const result = await dataAccessService.executeWebMethod({
            url: this.url,
            username: this.username,
            password: this.password,
            webservice: webservice,
            method: method,
            parameters: parameters
        });
        
        return result;
    }

    // ===================
    // INSURED FUNCTIONS
    // ===================

    async addInsuredWithLocation(data) {
        // Use existing insured service
        const token = await authService.getToken(this.url, this.username, this.password);
        const result = await insuredService.addInsuredWithLocation(this.url, token, data);
        return result;
    }

    async findInsuredByName(searchTerm) {
        // Use existing insured service
        const token = await authService.getToken(this.url, this.username, this.password);
        const result = await insuredService.findInsuredByName(this.url, token, searchTerm);
        return result;
    }

    // ===================
    // SUBMISSION/QUOTE FUNCTIONS
    // ===================

    async createSubmission(data) {
        // Use existing submission service
        const token = await authService.getToken(this.url, this.username, this.password);
        const result = await submissionService.createSubmission(this.url, token, data);
        return result;
    }

    async addQuote(data) {
        // Use web method for quote creation
        const result = await this.executeWebMethod('QuoteFunctions', 'AddQuote', data);
        return result;
    }

    async bindQuote(quoteGuid, options = {}) {
        // Use web method for binding
        const result = await this.executeWebMethod('QuoteFunctions', 'BindQuote', {
            quoteGuid: quoteGuid,
            ...options
        });
        return result;
    }

    // ===================
    // PRODUCER FUNCTIONS
    // ===================

    async searchProducers(searchTerm) {
        // Use existing producer service
        const token = await authService.getToken(this.url, this.username, this.password);
        const result = await producerService.searchProducers(this.url, token, searchTerm);
        return result;
    }

    async getProducersBySearchType(searchType, searchValue) {
        // Use existing producer service
        const token = await authService.getToken(this.url, this.username, this.password);
        const result = await producerService.getProducersBySearchType(this.url, token, searchType, searchValue);
        return result;
    }

    // ===================
    // DOCUMENT FUNCTIONS
    // ===================

    async createPolicyDocument(policyNumber, documentTypeId) {
        // Use web method for document creation
        const result = await this.executeWebMethod('DocumentFunctions', 'CreatePolicyDocument', {
            policyNumber: policyNumber,
            documentTypeID: documentTypeId
        });
        return result;
    }

    async uploadDocument(documentData) {
        // Use web method for document upload
        const result = await this.executeWebMethod('DocumentFunctions', 'InsertStandardDocument', documentData);
        return result;
    }

    // ===================
    // UTILITY FUNCTIONS
    // ===================

    async getFormsList(params = {}) {
        // Get available forms using stored procedure
        const result = await this.executeStoredProcedure('DK_GetCompanyLineForms_WS', params);
        return result;
    }

    async getStates() {
        // Get states list
        const result = await this.executeStoredProcedure('DK_GetStates_WS', {});
        return result;
    }

    async getCompanies() {
        // Get companies list
        const result = await this.executeStoredProcedure('DK_GetCompanies_WS', {});
        return result;
    }

    async getLines() {
        // Get lines of business
        const result = await this.executeStoredProcedure('DK_GetLines_WS', {});
        return result;
    }
}

// Export factory function to create helper instances
module.exports = {
    createIMSHelper: (instanceConfig) => new IMSHelperFunctions(instanceConfig),
    
    // Export available function mappings for UI documentation
    availableFunctions: {
        authentication: [
            {
                name: 'login',
                description: 'Authenticate with IMS and get token',
                parameters: [],
                returns: { token: 'string', userGuid: 'string' }
            }
        ],
        dataAccess: [
            {
                name: 'executeStoredProcedure',
                description: 'Execute any IMS stored procedure (must have _WS suffix)',
                parameters: ['procedureName', 'parameters (object)'],
                returns: 'result set',
                example: 'await ims_functions.executeStoredProcedure("DK_Policy_Search_WS", { "@PolicyNumber": "GL123456" })'
            },
            {
                name: 'executeWebMethod',
                description: 'Execute any IMS web service method',
                parameters: ['webservice', 'method', 'parameters'],
                returns: 'method result',
                example: 'await ims_functions.executeWebMethod("InsuredFunctions", "GetInsured", { insuredGuid: "xxx-xxx" })'
            }
        ],
        insured: [
            {
                name: 'addInsuredWithLocation',
                description: 'Create insured with primary location',
                parameters: ['data object with insuredName, businessType, address1, city, state, zip, email'],
                returns: { insuredGuid: 'string', locationGuid: 'string' }
            },
            {
                name: 'findInsuredByName',
                description: 'Search for insureds by name',
                parameters: ['searchTerm'],
                returns: 'array of insureds'
            }
        ],
        quote: [
            {
                name: 'createSubmission',
                description: 'Create a new submission',
                parameters: ['data object with insuredGuid, producerGuid, lineOfBusiness, etc.'],
                returns: { submissionGuid: 'string' }
            },
            {
                name: 'addQuote',
                description: 'Create a new quote',
                parameters: ['quote data object'],
                returns: 'quoteGuid'
            },
            {
                name: 'bindQuote',
                description: 'Bind quote to create policy',
                parameters: ['quoteGuid', 'options'],
                returns: 'policyNumber'
            }
        ],
        producer: [
            {
                name: 'searchProducers',
                description: 'Search for producers',
                parameters: ['searchTerm'],
                returns: 'array of producers'
            },
            {
                name: 'getProducersBySearchType',
                description: 'Get producers by specific search type',
                parameters: ['searchType', 'searchValue'],
                returns: 'array of producers'
            }
        ],
        document: [
            {
                name: 'createPolicyDocument',
                description: 'Generate policy document',
                parameters: ['policyNumber', 'documentTypeId'],
                returns: { success: 'boolean', documentData: 'base64' }
            },
            {
                name: 'uploadDocument',
                description: 'Upload document to IMS',
                parameters: ['documentData object'],
                returns: 'documentGuid'
            }
        ],
        utility: [
            {
                name: 'getFormsList',
                description: 'Get available forms',
                parameters: ['params object (optional)'],
                returns: 'array of forms'
            },
            {
                name: 'getStates',
                description: 'Get list of states',
                parameters: [],
                returns: 'array of states'
            },
            {
                name: 'getCompanies',
                description: 'Get list of companies',
                parameters: [],
                returns: 'array of companies'
            },
            {
                name: 'getLines',
                description: 'Get lines of business',
                parameters: [],
                returns: 'array of lines'
            }
        ]
    }
};