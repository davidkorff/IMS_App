const pool = require('../config/db');
const IMSService = require('./imsService');
const dataAccess = require('./dataAccess');
const ExcelJS = require('exceljs');
const ExcelFormulaExecutor = require('./excelFormulaExecutor');
const XLSXCalcWrapper = require('./xlsxCalcWrapper');
const ExcelMinimalEditor = require('./excelMinimalEditor');
const ExcelComCalculator = require('./excelComCalculator');
const LibreOfficeCalculator = require('./libreOfficeCalculator');

class ProducerSubmissionProcessor {
    constructor() {
        // Will initialize IMS service with instance credentials later
        this.imsService = null;
        this.businessTypes = null; // Cache business types
        this.formulaExecutor = new ExcelFormulaExecutor();
        this.xlsxCalc = new XLSXCalcWrapper();
        this.minimalEditor = new ExcelMinimalEditor();
        this.excelComCalculator = new ExcelComCalculator();
        this.libreOfficeCalculator = new LibreOfficeCalculator();
    }

    async processSubmission(submissionId, producerId) {
        const client = await pool.connect();
        
        try {
            // Get submission data with instance credentials
            const submissionResult = await client.query(`
                SELECT 
                    s.*,
                    lob.lob_id,
                    lob.line_name,
                    lob.ims_line_guid,
                    lob.ims_company_guid,
                    lob.ims_company_location_guid,
                    lob.ims_quoting_location_guid,
                    lob.ims_issuing_location_guid,
                    lob.ims_underwriter_guid,
                    lob.ims_producer_contact_guid AS default_producer_contact_guid,
                    lob.ims_producer_location_guid AS default_producer_location_guid,
                    lob.ims_procedure_id,
                    lob.ims_procedure_name,
                    lob.ims_rating_type_id,
                    lob.rater_file_data,
                    lob.rater_file_name,
                    lob.excel_formula_calculation,
                    lob.formula_calc_method,
                    p.email as producer_email,
                    p.first_name as producer_first_name,
                    p.last_name as producer_last_name,
                    p.ims_producer_guid as producer_guid,
                    p.ims_producer_contact_guid as ims_contact_guid,
                    p.ims_producer_location_guid,
                    i.instance_id,
                    i.url,
                    i.username,
                    i.password
                FROM custom_route_submissions s
                JOIN custom_routes r ON s.route_id = r.route_id
                JOIN portal_lines_of_business lob ON r.lob_id = lob.lob_id
                JOIN producers p ON p.producer_id = $2
                JOIN ims_instances i ON lob.instance_id = i.instance_id
                WHERE s.submission_id = $1
            `, [submissionId, producerId]);

            if (submissionResult.rows.length === 0) {
                throw new Error('Submission not found');
            }

            const submission = submissionResult.rows[0];
            const formData = submission.form_data;
            const imsData = formData.imsData || formData.ims_data;
            const customData = formData.customData || formData.custom_data;
            
            console.log('Producer data:', {
                producer_guid: submission.producer_guid,
                ims_contact_guid: submission.ims_contact_guid,
                ims_producer_location_guid: submission.ims_producer_location_guid,
                producer_email: submission.producer_email
            });

            // Initialize IMS service with instance credentials
            this.imsService = new IMSService({
                url: submission.url,
                username: submission.username,
                password: submission.password
            });

            // Update status to processing
            await client.query(`
                UPDATE custom_route_submissions 
                SET status = 'processing', workflow_step = 'creating_insured'
                WHERE submission_id = $1
            `, [submissionId]);

            // Step 1: Create Insured in IMS
            console.log('Creating insured in IMS...');
            const insuredGuid = await this.createInsuredInIMS(imsData, submission);
            
            // Step 2: Create Submission and Quote in IMS
            console.log('Creating submission and quote in IMS...');
            const { submissionGuid, quoteGuid } = await this.createSubmissionAndQuoteInIMS(
                insuredGuid,
                submission,
                imsData,
                customData
            );

            // Step 3: Get Control Number
            console.log('Getting control number for quote:', quoteGuid);
            let controlNumber = null;
            try {
                controlNumber = await this.imsService.getControlNumber(quoteGuid);
                console.log('Control number retrieved:', controlNumber);
            } catch (error) {
                console.warn('Could not retrieve control number:', error.message);
                // Control number might not be available immediately, continue without it
            }

            // Step 4: Auto-add Quote Details first (required for quote options)
            console.log('Auto-adding quote details...');
            try {
                await this.imsService.autoAddQuoteDetails(quoteGuid);
                console.log('Quote details added successfully');
            } catch (error) {
                console.warn('Failed to auto-add quote details:', error.message);
                // This is critical - rating may fail without details
            }
            
            // Step 5: Process Excel Rater FIRST (before creating quote options)
            console.log('Excel rater processing...');
            let premium = null;
            let raterResults = null;
            let processedExcelBuffer = null;
            
            if (submission.rater_file_data) {
                console.log('Excel rater file available:', submission.rater_file_name);
                
                try {
                    // First, populate and save the Excel rater
                    const excelResult = await this.populateAndSaveExcelRater(
                        submission,
                        quoteGuid,
                        imsData,
                        customData
                    );
                    
                    processedExcelBuffer = excelResult.processedBuffer;
                    raterResults = excelResult.raterResults;
                    
                } catch (error) {
                    console.error('Excel rater population failed:', error);
                    // Continue without rater - underwriter can handle manually in IMS
                }
            }

            // Step 6: Auto-add Quote Options FIRST (before stored procedure)
            console.log('\n=== Auto-adding quote options ===');
            console.log('Quote GUID:', quoteGuid);
            
            let quoteOptions = [];
            let quoteOptionGuid = null;
            
            try {
                const optionStartTime = Date.now();
                quoteOptions = await this.imsService.autoAddQuoteOptions(quoteGuid);
                const optionTime = Date.now() - optionStartTime;
                
                console.log(`\nQuote options creation completed in ${optionTime}ms`);
                console.log('Quote options returned by API:', quoteOptions.length);
                
                if (quoteOptions.length > 0) {
                    console.log('\nQuote options details from API:');
                    quoteOptions.forEach((option, index) => {
                        console.log(`\nOption ${index + 1}:`);
                        console.log('- GUID:', option.QuoteOptionGUID || option.quoteOptionGuid || 'not found');
                        console.log('- Name:', option.Name || option.name || 'not found');
                        console.log('- Type:', option.Type || option.type || 'not found');
                        console.log('- Full details:', JSON.stringify(option, null, 2));
                    });
                    quoteOptionGuid = quoteOptions[0].QuoteOptionGUID || quoteOptions[0].quoteOptionGuid;
                } else {
                    console.log('\n⚠️  No quote options returned by AutoAddQuoteOptions');
                    console.log('BUT options may have been created in IMS without being returned');
                    
                    // Since you mentioned options ARE created, let's try to get the quote info
                    try {
                        console.log('\nAttempting to retrieve quote information...');
                        const quoteInfo = await dataAccess.executeProc({
                            url: submission.url,
                            username: submission.username,
                            password: submission.password,
                            procedure: 'GetQuoteInformation',
                            parameters: {
                                QuoteGUID: quoteGuid
                            }
                        });
                        
                        console.log('Quote info result:', JSON.stringify(quoteInfo, null, 2));
                        
                        // Check if we can find the quote option GUID in the result
                        if (quoteInfo && quoteInfo.Table && quoteInfo.Table.length > 0) {
                            const row = quoteInfo.Table[0];
                            if (row.QuoteOptionGUID) {
                                quoteOptionGuid = row.QuoteOptionGUID;
                                console.log(`✓ Found QuoteOptionGUID from GetQuoteInformation: ${quoteOptionGuid}`);
                                quoteOptions = [{ QuoteOptionGUID: quoteOptionGuid }];
                            }
                        }
                    } catch (infoError) {
                        console.log('Could not retrieve quote information:', infoError.message);
                    }
                    
                    if (!quoteOptionGuid) {
                        console.warn('\nPossible reasons for no options:');
                        console.warn('1. CompanyLine is not properly configured in IMS');
                        console.warn('2. Line/State combination is not set up');
                        console.warn('3. Options created but API not returning them');
                        console.warn('\nCheck in IMS:');
                        console.warn(`- Quote GUID: ${quoteGuid}`);
                        console.warn(`- Control Number: ${controlNumber}`);
                        console.warn('- Look for the QuoteOptionGUID in the IMS UI');
                    }
                }
            } catch (error) {
                console.error('\n❌ Failed to auto-add quote options');
                console.error('Error:', error.message);
                if (error.response) {
                    console.error('Response data:', error.response.data);
                }
                // Continue without options - some lines may not require them
            }
            
            // Step 7: Execute stored procedure with Quote Option GUID (after creating options)
            if ((submission.ims_procedure_name || submission.formula_calc_method !== 'none') && quoteOptionGuid) {
                console.log('\n=== Executing Rating Stored Procedure ===');
                console.log('Decision to execute procedure:');
                console.log('- ims_procedure_name:', submission.ims_procedure_name || 'not set');
                console.log('- formula_calc_method:', submission.formula_calc_method || 'not set');
                console.log('- processedExcelBuffer available:', !!processedExcelBuffer);
                console.log('- quoteOptions available:', quoteOptions.length);
                
                // Use LOB-specific procedure or default ExcelRating_RateOption4
                let procedureName = submission.ims_procedure_name || 'ExcelRating_RateOption4';
                console.log('Original procedure name:', procedureName);
                
                // Strip _WS suffix if present (DataAccess will add it back)
                if (procedureName.endsWith('_WS')) {
                    procedureName = procedureName.slice(0, -3);
                    console.log('Stripped _WS suffix, now:', procedureName);
                }
                
                console.log(`\nExecuting ${procedureName} for quote option: ${quoteOptionGuid}`);
                console.log('IMS instance details:');
                console.log('- URL:', submission.url);
                console.log('- Username:', submission.username);
                console.log('- Password length:', submission.password ? submission.password.length : 0);
                        
                try {
                    console.log('\nCalling dataAccess.executeProc with parameters:');
                    console.log(JSON.stringify({
                        procedure: procedureName,
                        parameters: { QuoteOptionGUID: quoteOptionGuid }
                    }, null, 2));
                    
                    const startTime = Date.now();
                    const procResult = await dataAccess.executeProc({
                        url: submission.url,
                        username: submission.username,
                        password: submission.password,
                        procedure: procedureName,
                        parameters: {
                            QuoteOptionGUID: quoteOptionGuid
                        }
                    });
                    const executionTime = Date.now() - startTime;
                    console.log(`\nStored procedure execution time: ${executionTime}ms`);
                            
                    console.log('\n=== Stored Procedure Execution Results ===');
                    console.log('Success: YES');
                    console.log('Result type:', typeof procResult);
                    console.log('Result keys:', procResult ? Object.keys(procResult) : 'null');
                    console.log('Full result:', JSON.stringify(procResult, null, 2));
                    
                    // The stored procedure doesn't return the premium, it calculates and stores it in IMS
                    console.log('\nStored procedure completed. Premium has been calculated and stored in IMS.');
                    console.log('Now we need to fetch the calculated premium from IMS...');
                    
                    // Try multiple methods to get the premium from IMS
                    console.log('Attempting to fetch the calculated premium from IMS...');
                    
                    // Method 1: Try GetPolicyInformation
                    try {
                        console.log('\nMethod 1: Trying GetPolicyInformation with QuoteGuid:', quoteGuid);
                        const policyInfo = await this.imsService.getPolicyInformation(quoteGuid);
                        
                        if (policyInfo) {
                            console.log('Policy information retrieved, searching for premium...');
                            
                            // The response structure may vary, check different paths
                            if (policyInfo.QuoteDetails && policyInfo.QuoteDetails.QuoteOption) {
                                const options = Array.isArray(policyInfo.QuoteDetails.QuoteOption) 
                                    ? policyInfo.QuoteDetails.QuoteOption 
                                    : [policyInfo.QuoteDetails.QuoteOption];
                                    
                                for (const option of options) {
                                    if (option && option.Premium) {
                                        premium = parseFloat(option.Premium);
                                        console.log(`✓ Retrieved premium from GetPolicyInformation: ${premium}`);
                                        break;
                                    }
                                }
                            }
                            
                            // Check for Total_Allied_Health_Policy_Premium in different locations
                            if (!premium) {
                                const checkForPremium = (obj, path = '') => {
                                    for (const key in obj) {
                                        if (key.toLowerCase().includes('premium') && obj[key]) {
                                            console.log(`Found potential premium at ${path}.${key}: ${obj[key]}`);
                                            if (!isNaN(parseFloat(obj[key]))) {
                                                return parseFloat(obj[key]);
                                            }
                                        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                            const found = checkForPremium(obj[key], `${path}.${key}`);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                };
                                
                                premium = checkForPremium(policyInfo);
                                if (premium) {
                                    console.log(`✓ Found premium in policy information: ${premium}`);
                                }
                            }
                        }
                    } catch (error) {
                        console.log('GetPolicyInformation failed:', error.message);
                    }
                    
                    // Method 2: Try GetQuoteOptionPremium procedure
                    if (!premium) {
                        try {
                            console.log('\nMethod 2: Trying GetQuoteOptionPremium with QuoteOptionGUID:', quoteOptionGuid);
                            const premiumResult = await dataAccess.executeProc({
                                url: submission.url,
                                username: submission.username,
                                password: submission.password,
                                procedure: 'GetQuoteOptionPremium',
                                parameters: {
                                    QuoteOptionGUID: quoteOptionGuid
                                }
                            });
                            
                            if (premiumResult && premiumResult.Table && premiumResult.Table.length > 0) {
                                const row = premiumResult.Table[0];
                                const premiumValue = row.Premium || row.TotalPremium || row.PremiumAmount || row.Total;
                                if (premiumValue) {
                                    premium = parseFloat(premiumValue);
                                    console.log(`✓ Retrieved premium from GetQuoteOptionPremium: ${premium}`);
                                }
                            }
                        } catch (error) {
                            console.log('GetQuoteOptionPremium not available or failed:', error.message);
                        }
                    }
                    
                    // Method 3: Try GetQuotePremium with QuoteGUID
                    if (!premium) {
                        try {
                            console.log('\nMethod 3: Trying GetQuotePremium with QuoteGUID:', quoteGuid);
                            const premiumResult = await dataAccess.executeProc({
                                url: submission.url,
                                username: submission.username,
                                password: submission.password,
                                procedure: 'GetQuotePremium',
                                parameters: {
                                    QuoteGUID: quoteGuid
                                }
                            });
                            
                            if (premiumResult && premiumResult.Table && premiumResult.Table.length > 0) {
                                const row = premiumResult.Table[0];
                                const premiumValue = row.Premium || row.TotalPremium || row.Total_Allied_Health_Policy_Premium;
                                if (premiumValue) {
                                    premium = parseFloat(premiumValue);
                                    console.log(`✓ Retrieved premium from GetQuotePremium: ${premium}`);
                                }
                            }
                        } catch (error) {
                            console.log('GetQuotePremium not available or failed:', error.message);
                        }
                    }
                    
                    // Method 4: Try a generic GetDynamicData procedure
                    if (!premium) {
                        try {
                            console.log('\nMethod 4: Trying GetDynamicData for Allied Health premium');
                            const premiumResult = await dataAccess.executeProc({
                                url: submission.url,
                                username: submission.username,
                                password: submission.password,
                                procedure: 'GetDynamicData',
                                parameters: {
                                    TableName: 'Dynamic_Data_AlliedHealth',
                                    QuoteGUID: quoteGuid
                                }
                            });
                            
                            if (premiumResult && premiumResult.Table && premiumResult.Table.length > 0) {
                                const row = premiumResult.Table[0];
                                const premiumValue = row.Total_Allied_Health_Policy_Premium || row.Premium;
                                if (premiumValue) {
                                    premium = parseFloat(premiumValue);
                                    console.log(`✓ Retrieved premium from Dynamic_Data_AlliedHealth: ${premium}`);
                                }
                            }
                        } catch (error) {
                            console.log('GetDynamicData not available or failed:', error.message);
                        }
                    }
                    
                    if (!premium) {
                        console.log('\n⚠️  Could not retrieve premium from IMS after stored procedure');
                        console.log('The premium may have been calculated but we need the correct procedure name to retrieve it');
                        console.log('Will attempt to extract from Excel as fallback');
                    }
                    
                    // Update rater results
                    raterResults = {
                        ...raterResults,
                        storedProcedureExecuted: true,
                        storedProcedureName: procedureName,
                        storedProcedureResult: procResult
                    };
                    
                } catch (procError) {
                    console.error('\n=== Stored Procedure Execution Failed ===');
                    console.error('Error type:', procError.constructor.name);
                    console.error('Error message:', procError.message);
                    console.error('Error stack:', procError.stack);
                    if (procError.response) {
                        console.error('HTTP Response:', {
                            status: procError.response.status,
                            statusText: procError.response.statusText,
                            data: procError.response.data
                        });
                    }
                    // Continue without procedure result
                }
            }
            
            // Step 8: If we still don't have premium, try to extract it from Excel
            if (!premium && processedExcelBuffer) {
                console.log('\n=== Extracting Premium from Excel ===');
                console.log('Premium not found from stored procedure, checking Excel file...');
                console.log('LOB ID:', submission.lob_id);
                
                try {
                    premium = await this.extractPremiumFromExcel(processedExcelBuffer, submission.lob_id);
                    if (premium) {
                        console.log(`✓ Successfully extracted premium from Excel: ${premium}`);
                        
                        // Update rater results
                        raterResults = {
                            ...raterResults,
                            extractedPremium: premium,
                            premiumSource: 'excel_extraction'
                        };
                    } else {
                        console.log('✗ No premium found in Excel file');
                        console.log('Check that:');
                        console.log('- Formula calculation method is set correctly');
                        console.log('- Excel formulas are calculating properly');
                        console.log('- Premium mapping is configured for LOB', submission.lob_id);
                    }
                } catch (extractError) {
                    console.error('Error during Excel premium extraction:', extractError.message);
                    console.error('Extract error stack:', extractError.stack);
                }
            } else if (premium) {
                console.log(`\n✓ Premium already obtained: ${premium}`);
            } else {
                console.log('\n✗ No processed Excel buffer available for premium extraction');
            }
            

            // Step 9: Update submission with IMS data
            await client.query(`
                UPDATE custom_route_submissions 
                SET 
                    status = 'quoted',
                    workflow_step = 'complete',
                    ims_submission_guid = $2,
                    ims_quote_guid = $3,
                    updated_at = CURRENT_TIMESTAMP,
                    form_data = form_data || jsonb_build_object(
                        'imsResults', $4::jsonb,
                        'raterResults', $5::jsonb
                    )
                WHERE submission_id = $1
            `, [
                submissionId,
                submissionGuid,
                quoteGuid,
                JSON.stringify({
                    insuredGuid,
                    submissionGuid,
                    quoteGuid,
                    controlNumber,
                    premium
                }),
                JSON.stringify(raterResults || {})
            ]);

            // Log the successful processing with all IMS references
            console.log('\n=== SUBMISSION PROCESSING COMPLETE ===');
            console.log('✓ Submission ID:', submissionId);
            console.log('✓ Insured GUID:', insuredGuid);
            console.log('✓ Submission GUID:', submissionGuid);
            console.log('✓ Quote GUID:', quoteGuid);
            console.log('✓ Control Number:', controlNumber);
            console.log('✓ Premium:', premium || 'Not found');
            console.log('✓ Quote Options Created:', quoteOptions.length);
            
            if (raterResults) {
                console.log('\nRater Results Summary:');
                console.log('- Success:', raterResults.success || false);
                console.log('- Saved to IMS:', raterResults.savedToIMS || false);
                console.log('- Data Imported:', raterResults.dataImported || false);
                console.log('- Formula Calculation:', raterResults.formulaCalculation || 'none');
                console.log('- Stored Procedure Executed:', raterResults.storedProcedureExecuted || false);
                console.log('- Premium Source:', raterResults.premiumSource || 'none');
                console.log('- Method:', raterResults.method || 'unknown');
            }
            
            console.log('\n✓ Status: QUOTED');
            console.log('=====================================\n');
            
            await client.query(`
                INSERT INTO producer_audit_log (
                    producer_id, action, details, created_at
                ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            `, [
                producerId,
                'submission_processed',
                JSON.stringify({
                    submission_id: submissionId,
                    insured_guid: insuredGuid,
                    submission_guid: submissionGuid,
                    quote_guid: quoteGuid,
                    control_number: controlNumber,
                    premium: premium,
                    line_name: submission.line_name
                })
            ]);

            return {
                success: true,
                insuredGuid,
                submissionGuid,
                quoteGuid,
                controlNumber,
                premium,
                raterResults
            };

        } catch (error) {
            console.error('Error processing submission:', error);
            
            // Update submission status to failed
            await client.query(`
                UPDATE custom_route_submissions 
                SET 
                    status = 'failed',
                    workflow_step = 'error',
                    form_data = form_data || jsonb_build_object(
                        'error', $2::text
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE submission_id = $1
            `, [submissionId, error.message]);

            throw error;
        } finally {
            client.release();
        }
    }

    async fetchBusinessTypes(instance) {
        // Try to fetch business types from IMS if not cached
        if (!this.businessTypes) {
            try {
                const result = await dataAccess.executeProc({
                    url: instance.url,
                    username: instance.username,
                    password: instance.password,
                    procedure: 'DK_GetTableData_WS',
                    parameters: {
                        TableName: 'lstBusinessTypes'
                    }
                });
                
                if (result && result.Table && result.Table.length > 0) {
                    this.businessTypes = result.Table;
                    console.log('Fetched business types from IMS:', this.businessTypes);
                }
            } catch (error) {
                console.warn('Could not fetch business types from IMS, using defaults:', error.message);
                // Use known defaults if we can't fetch from IMS
                this.businessTypes = [
                    { BusinessTypeID: 4, BusinessType: 'Individual' },
                    { BusinessTypeID: 13, BusinessType: 'Corporation' },
                    { BusinessTypeID: 2, BusinessType: 'Partnership' },
                    { BusinessTypeID: 9, BusinessType: 'Limited Liability Corporation' },
                    { BusinessTypeID: 5, BusinessType: 'Other' }
                ];
            }
        }
        
        return this.businessTypes;
    }
    
    async createInsuredInIMS(imsData, submission) {
        // BusinessTypeID mapping from IMS test environment:
        // 4 = Individual
        // 13 = Corporation 
        // 2 = Partnership
        // 9 = LLC
        // 5 = Other
        let businessTypeId = 4; // Default to Individual
        
        if (imsData.businessType !== undefined && imsData.businessType !== '') {
            const typeId = parseInt(imsData.businessType);
            // Only use the provided ID if it's a valid number and likely to exist
            if (!isNaN(typeId) && typeId >= 0) {
                businessTypeId = typeId;
            }
        }
        
        console.log('Using BusinessTypeID:', businessTypeId, 'from input:', imsData.businessType);
        
        const insuredData = {
            BusinessTypeID: businessTypeId,
            Salutation: imsData.salutation || '',
            FirstName: imsData.firstName || '',
            MiddleName: imsData.middleName || '',
            LastName: imsData.lastName || '',
            CorporationName: imsData.corporationName || '',
            NameOnPolicy: imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`,
            DBA: imsData.dba || '',
            FEIN: imsData.fein || '',
            SSN: imsData.ssn || '',
            DateOfBirth: imsData.dateOfBirth || null,
            Office: submission.ims_company_guid
        };

        const locationData = {
            LocationName: 'Primary Location',
            LocationTypeID: 1, // 1 = Primary Location
            Address1: imsData.address1,
            Address2: imsData.address2 || '',
            City: imsData.city,
            State: imsData.state,
            Zip: imsData.zip,
            Phone: imsData.phone,
            Email: imsData.email,
            ISOCountryCode: 'US', // Required field - defaulting to US
            DeliveryMethodID: 1 // 1 = Mail (default delivery method)
        };

        const contactData = {
            DeliveryMethodID: 1, // 1 = Mail (same as location)
            Salutation: imsData.salutation || '',
            FirstName: imsData.firstName || imsData.corporationName || '',
            LastName: imsData.lastName || '',
            Phone: imsData.phone,
            Email: imsData.email,
            Address1: imsData.address1,
            Address2: imsData.address2 || '',
            City: imsData.city,
            State: imsData.state,
            Zip: imsData.zip,
            ISOCountryCode: 'US' // Required field - defaulting to US
        };

        return await this.imsService.addInsuredWithContact(
            insuredData,
            locationData,
            contactData
        );
    }

    async createSubmissionAndQuoteInIMS(insuredGuid, submission, imsData, customData) {
        // Get today's date and 1 year from now
        const today = new Date();
        const nextYear = new Date(today);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        
        // Get validated business type ID
        let businessTypeId = 4; // Default to Individual (ID=4 in IMS test)
        if (imsData.businessType !== undefined && imsData.businessType !== '') {
            const typeId = parseInt(imsData.businessType);
            if (!isNaN(typeId) && typeId >= 0) {
                businessTypeId = typeId;
            }
        }

        // Determine producer contact GUID
        console.log('Producer GUID determination:', {
            ims_contact_guid: submission.ims_contact_guid,
            default_producer_contact_guid: submission.default_producer_contact_guid,
            ims_producer_location_guid: submission.ims_producer_location_guid,
            default_producer_location_guid: submission.default_producer_location_guid
        });
        
        let producerContactGuid = submission.ims_contact_guid;
        
        // Skip if it's a mock GUID
        if (producerContactGuid && typeof producerContactGuid === 'string' && producerContactGuid.startsWith('MOCK')) {
            producerContactGuid = null;
        }
        
        if (!producerContactGuid && submission.producer_email) {
            // Try to find producer in IMS by email
            try {
                const searchResults = await this.imsService.searchProducerByEmail(submission.producer_email);
                if (searchResults && searchResults.length > 0) {
                    // Use the first matching producer location
                    // In a real implementation, you might want to let the admin choose
                    producerContactGuid = searchResults[0].ProducerLocationGuid;
                    
                    // Optionally update the producer record with the found GUID
                    await pool.query(`
                        UPDATE producers 
                        SET ims_contact_guid = $1, ims_producer_location_guid = $1
                        WHERE producer_id = $2
                    `, [producerContactGuid, submission.producer_id]);
                }
            } catch (error) {
                console.error('Error searching for producer in IMS:', error);
            }
        }
        
        // If still no producer contact, check for default from LOB
        if (!producerContactGuid && submission.default_producer_contact_guid) {
            console.log('Using default producer contact from LOB:', submission.default_producer_contact_guid);
            producerContactGuid = submission.default_producer_contact_guid;
        }
        
        // Last resort: use company GUID as fallback
        if (!producerContactGuid) {
            console.warn('No producer contact found, using company GUID as fallback');
            producerContactGuid = submission.ims_company_guid;
        }

        // Validate producer location GUID
        let producerLocationGuid = submission.ims_producer_location_guid;
        if (!producerLocationGuid || (typeof producerLocationGuid === 'string' && producerLocationGuid.startsWith('MOCK'))) {
            producerLocationGuid = submission.default_producer_location_guid || producerContactGuid;
        }

        const submissionData = {
            Insured: insuredGuid,
            ProducerContact: producerContactGuid || submission.default_producer_contact_guid,
            Underwriter: submission.ims_underwriter_guid || submission.ims_company_guid,
            SubmissionDate: today.toISOString().split('T')[0],
            ProducerLocation: producerLocationGuid || submission.default_producer_location_guid || producerContactGuid
        };

        // Validate producer GUID for quote
        let quoteProducerContact = submission.producer_guid;
        
        // Check if it's a mock or invalid GUID
        if (!quoteProducerContact || 
            (typeof quoteProducerContact === 'string' && quoteProducerContact.startsWith('MOCK')) ||
            (typeof quoteProducerContact === 'string' && quoteProducerContact.includes('MOCK'))) {
            
            // Try to use the producer's IMS contact GUID first
            if (submission.ims_contact_guid && !submission.ims_contact_guid.includes('MOCK')) {
                quoteProducerContact = submission.ims_contact_guid;
            } else if (producerContactGuid && !producerContactGuid.includes('MOCK')) {
                quoteProducerContact = producerContactGuid;
            } else {
                // Last resort: use company GUID
                quoteProducerContact = submission.ims_company_guid;
            }
        }

        const companyGuid = submission.ims_company_guid;
        
        console.log('Quote location GUIDs:', {
            ims_quoting_location_guid: submission.ims_quoting_location_guid,
            ims_issuing_location_guid: submission.ims_issuing_location_guid,
            ims_company_location_guid: submission.ims_company_location_guid,
            companyGuid: companyGuid
        });
        
        const quoteData = {
            QuotingLocation: submission.ims_quoting_location_guid || companyGuid,
            IssuingLocation: submission.ims_issuing_location_guid || companyGuid,
            CompanyLocation: submission.ims_company_location_guid || companyGuid,
            Line: submission.ims_line_guid || companyGuid, // Fallback to company GUID if line GUID missing
            StateID: imsData.state,
            ProducerContact: quoteProducerContact,
            QuoteStatusID: 1, // New/Pending
            Effective: today.toISOString().split('T')[0],
            Expiration: nextYear.toISOString().split('T')[0],
            BillingTypeID: 1, // Direct Bill
            QuoteDetail: null, // Let IMS auto-calculate details
            Underwriter: submission.ims_underwriter_guid || submission.ims_company_guid,
            PolicyTypeID: 1, // New Business
            InsuredBusinessTypeID: businessTypeId, // Use the validated businessTypeId
            RiskInformation: {
                PolicyName: imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`,
                CorporationName: imsData.corporationName || '',
                DBA: imsData.dba || '',
                Salutation: imsData.salutation || '',
                FirstName: imsData.firstName || '',
                MiddleName: imsData.middleName || '',
                LastName: imsData.lastName || '',
                SSN: imsData.ssn || '',
                FEIN: imsData.fein || '',
                Address1: imsData.address1,
                Address2: imsData.address2 || '',
                City: imsData.city,
                State: imsData.state,
                ZipCode: imsData.zip,
                Phone: imsData.phone,
                BusinessType: businessTypeId
            }
        };

        const result = await this.imsService.addQuoteWithSubmission(
            submissionData,
            quoteData
        );

        return {
            submissionGuid: result.submissionGuid,
            quoteGuid: result.quoteGuid
        };
    }

    async processExcelRater(submission, quoteGuid, quoteOptions, imsData, customData) {
        console.log('Processing Excel rater for quote:', quoteGuid);
        
        // Variable to store premium if found during calculation
        let calculatedPremium = null;
        
        // Decode the base64 Excel file
        const excelBuffer = Buffer.from(submission.rater_file_data, 'base64');
        
        // Check if we should use minimal editing approach (to avoid corruption)
        const useMinimalEditor = submission.use_minimal_editor !== false; // Default to true
        
        if (useMinimalEditor) {
            // Use minimal editor approach to avoid Excel corruption
            return await this.processExcelRaterMinimal(submission, quoteGuid, quoteOptions, imsData, customData, excelBuffer);
        }
        
        // Original ExcelJS approach (causes corruption with complex Excel files)
        console.warn('⚠️  Using ExcelJS approach - this may corrupt complex Excel files!');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);
        
        // Find the submission_data worksheet
        let submissionDataSheet = workbook.getWorksheet('submission_data');
        if (!submissionDataSheet) {
            // Try alternate names
            submissionDataSheet = workbook.getWorksheet('Submission_Data') || 
                                  workbook.getWorksheet('SubmissionData') ||
                                  workbook.getWorksheet('Data');
            
            if (!submissionDataSheet) {
                throw new Error('Could not find submission_data worksheet in Excel template');
            }
        }
        
        console.log('Found submission_data worksheet');
        
        // Populate the submission data
        // This mapping will need to be customized based on the actual Excel template structure
        // Common pattern is to have field names in column A and values in column B
        const effectiveDate = new Date().toISOString().split('T')[0];
        const expirationDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
        
        const dataMapping = {
            // IMS Data fields - multiple variations for each field
            'Insured_Name': imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`,
            'InsuredName': imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`,
            'Insured Name': imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`,
            'DBA': imsData.dba || '',
            'First_Name': imsData.firstName || '',
            'FirstName': imsData.firstName || '',
            'First Name': imsData.firstName || '',
            'Last_Name': imsData.lastName || '',
            'LastName': imsData.lastName || '',
            'Last Name': imsData.lastName || '',
            'Corporation_Name': imsData.corporationName || '',
            'CorporationName': imsData.corporationName || '',
            'Corporation Name': imsData.corporationName || '',
            'Business_Type': this.getBusinessTypeName(imsData.businessType),
            'BusinessType': this.getBusinessTypeName(imsData.businessType),
            'Business Type': this.getBusinessTypeName(imsData.businessType),
            'FEIN': imsData.fein || '',
            'SSN': imsData.ssn || '',
            'Address1': imsData.address1 || '',
            'Address 1': imsData.address1 || '',
            'Address2': imsData.address2 || '',
            'Address 2': imsData.address2 || '',
            'City': imsData.city || '',
            'State': imsData.state || '',
            'Zip': imsData.zip || '',
            'ZipCode': imsData.zip || '',
            'Zip Code': imsData.zip || '',
            'Phone': imsData.phone || '',
            'Email': imsData.email || '',
            'Effective_Date': effectiveDate,
            'EffectiveDate': effectiveDate,
            'Effective Date': effectiveDate,
            'Expiration_Date': expirationDate,
            'ExpirationDate': expirationDate,
            'Expiration Date': expirationDate,
            
            // Custom Data fields (from LOB-specific form)
            ...this.flattenCustomData(customData)
        };
        
        console.log('Available data fields for Excel population:', Object.keys(dataMapping));
        
        // First, let's see what's in the Excel - check all rows
        console.log('Excel submission_data worksheet contents:');
        const maxRows = submissionDataSheet.rowCount;
        console.log(`Total rows in worksheet: ${maxRows}`);
        
        // Check first 50 rows to understand the structure
        for (let rowNum = 1; rowNum <= Math.min(50, maxRows); rowNum++) {
            const row = submissionDataSheet.getRow(rowNum);
            const cellA = row.getCell(1).value;
            const cellB = row.getCell(2).value;
            const cellC = row.getCell(3).value;
            
            if (cellA || cellB || cellC) {
                console.log(`Row ${rowNum}: A="${cellA}" | B="${cellB}" | C="${cellC}"`);
            }
        }
        
        // Also check if there are any hidden rows or specific cells
        console.log('\nChecking specific cells that might contain data:');
        const specificCells = [
            'A1', 'B1', 'C1', 'D1',
            'A2', 'B2', 'C2', 'D2',
            'A3', 'B3', 'C3', 'D3'
        ];
        
        specificCells.forEach(cellRef => {
            const value = submissionDataSheet.getCell(cellRef).value;
            if (value) {
                console.log(`Cell ${cellRef}: "${value}"`);
            }
        });
        
        // Also check IMS_TAGS sheet for premium location
        const imsTagsSheet = workbook.getWorksheet('IMS_TAGS');
        if (imsTagsSheet) {
            console.log('\nChecking IMS_TAGS sheet for premium location:');
            ['B6', 'B7', 'B8', 'B9', 'B10'].forEach(cellRef => {
                const value = imsTagsSheet.getCell(cellRef).value;
                console.log(`IMS_TAGS!${cellRef}: "${value}"`);
            });
        }
        
        // Now populate the data - we'll write our data starting from row 1
        // Common Excel rater patterns use either:
        // 1. Field names in column A, values in column B
        // 2. Direct cell references for specific data
        
        console.log('\nPopulating submission data in Excel...');
        
        // First, let's try to populate specific known cells
        // Many Excel raters use specific cells for common fields
        const cellMappings = {
            'B1': imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`,
            'B2': imsData.dba || '',
            'B3': imsData.firstName || '',
            'B4': imsData.lastName || '',
            'B5': imsData.address1 || '',
            'B6': imsData.city || '',
            'B7': imsData.state || '',
            'B8': imsData.zip || '',
            'B9': imsData.phone || '',
            'B10': imsData.email || '',
            'B11': imsData.fein || '',
            'B12': effectiveDate,
            'B13': expirationDate
        };
        
        // Apply cell mappings
        Object.entries(cellMappings).forEach(([cell, value]) => {
            if (value) {
                submissionDataSheet.getCell(cell).value = value;
                console.log(`Set cell ${cell} = "${value}"`);
            }
        });
        
        // Also try to populate by creating our own field/value pairs
        // Starting from row 20 to avoid any existing data
        let currentRow = 20;
        const fieldValuePairs = [
            ['Insured Name', imsData.corporationName || `${imsData.firstName} ${imsData.lastName}`],
            ['DBA', imsData.dba || ''],
            ['First Name', imsData.firstName || ''],
            ['Last Name', imsData.lastName || ''],
            ['Corporation Name', imsData.corporationName || ''],
            ['Business Type', this.getBusinessTypeName(imsData.businessType)],
            ['FEIN', imsData.fein || ''],
            ['SSN', imsData.ssn || ''],
            ['Address1', imsData.address1 || ''],
            ['Address2', imsData.address2 || ''],
            ['City', imsData.city || ''],
            ['State', imsData.state || ''],
            ['Zip', imsData.zip || ''],
            ['Phone', imsData.phone || ''],
            ['Email', imsData.email || ''],
            ['Effective Date', effectiveDate],
            ['Expiration Date', expirationDate]
        ];
        
        // Add custom data fields
        if (customData && typeof customData === 'object') {
            Object.entries(customData).forEach(([key, value]) => {
                fieldValuePairs.push([key, value || '']);
            });
        }
        
        // Write field/value pairs
        fieldValuePairs.forEach(([field, value]) => {
            const row = submissionDataSheet.getRow(currentRow);
            row.getCell(1).value = field; // Column A
            row.getCell(2).value = value; // Column B
            console.log(`Row ${currentRow}: ${field} = "${value}"`);
            currentRow++;
        });
        
        console.log(`\nPopulated ${fieldValuePairs.length} fields in submission_data sheet`);
        
        // Pre-calculate formulas (IMS cannot calculate Excel formulas)
        console.log('Pre-calculating Excel formulas...');
        
        // First, save the workbook with populated data
        let processedBuffer = await workbook.xlsx.writeBuffer();
        
        // Keep a copy of the original formatted buffer
        const originalFormattedBuffer = processedBuffer;
        
        // Check if formula calculation is enabled for this LOB
        const shouldCalculateFormulas = submission.excel_formula_calculation !== false;
        const calcMethod = submission.formula_calc_method || 'none'; // Default to 'none' to avoid SheetJS issues
        
        if (!shouldCalculateFormulas || calcMethod === 'none') {
            console.log('Formula calculation disabled - IMS will handle it');
            console.log('This preserves Excel formatting and complex formulas.');
        } else if (calcMethod === 'xlsx-calc') {
            console.warn('\n⚠️  WARNING: xlsx-calc uses SheetJS which destroys Excel formatting!');
            console.warn('Recommend setting formula_calc_method to "none" in LOB configuration.');
            console.warn('Skipping formula calculation to preserve Excel integrity.\n');
            // DO NOT use xlsx-calc - it ruins the Excel file
                
        } else if (calcMethod === 'python' && await this.formulaExecutor.checkDependencies()) {
            // Python is much better at preserving Excel formatting
            try {
                console.log('\nUsing Python/openpyxl for formula calculation...');
                console.log('This method better preserves Excel formatting.');
                
                const allData = {
                    ...dataMapping,
                    cell_mappings: cellMappings
                };
                
                processedBuffer = await this.formulaExecutor.calculateFormulas(processedBuffer, allData);
                console.log('Excel formulas calculated successfully using Python');
                
            } catch (pythonError) {
                console.error('Python formula calculation failed:', pythonError.message);
                console.log('Using original Excel without formula calculation');
                processedBuffer = originalFormattedBuffer;
            }
        }
        
        // Log the final state of the workbook
        console.log('\nFinal workbook state before IMS import:');
        const finalWorkbook = new ExcelJS.Workbook();
        await finalWorkbook.xlsx.load(processedBuffer);
        
        // Check key cells in submission_data
        const submissionSheet = finalWorkbook.getWorksheet('submission_data') || 
                              finalWorkbook.getWorksheet('Submission_Data');
        if (submissionSheet) {
            console.log('\nSubmission_data contents (first 20 rows):');
            for (let i = 1; i <= 20; i++) {
                const row = submissionSheet.getRow(i);
                const a = row.getCell(1).value;
                const b = row.getCell(2).value;
                if (a || b) {
                    console.log(`  Row ${i}: ${a} = ${b}`);
                }
            }
        }
        
        // Convert to base64
        const processedBase64 = processedBuffer.toString('base64');
        
        // Save the rating sheet first
        console.log('Saving populated Excel rating sheet to IMS...');
        console.log('RaterID being used:', submission.ims_rating_type_id || 0);
        console.log('Quote GUID:', quoteGuid);
        console.log('File name:', submission.rater_file_name);
        try {
            const saveResult = await this.imsService.saveRatingSheet(
                quoteGuid,
                submission.ims_rating_type_id || 0,
                processedBase64,
                submission.rater_file_name
            );
            console.log('SaveRatingSheet result:', saveResult);
            console.log('Rating sheet saved successfully');
        } catch (saveError) {
            console.warn('Could not save rating sheet:', saveError.message);
        }
        
        // Import the Excel rater to IMS
        console.log('Importing Excel rater to IMS...');
        console.log('ImportExcelRater parameters:', {
            quoteGuid,
            fileName: submission.rater_file_name,
            raterID: submission.ims_rating_type_id || 0,
            factorSetGuid: null,
            applyFees: true
        });
        
        try {
            const importResult = await this.imsService.importExcelRater(
                quoteGuid,
                processedBase64,
                submission.rater_file_name,
                submission.ims_rating_type_id || 0,
                null, // FactorSetGuid - let IMS use latest
                true // ApplyFees - set to true to ensure fees are calculated
            );
            
            console.log('Excel import result:', JSON.stringify(importResult, null, 2));
            
            // Extract premium from result
            let totalPremium = 0;
            if (importResult.Success && importResult.Premiums && importResult.Premiums.length > 0) {
                importResult.Premiums.forEach(optionResult => {
                    totalPremium += parseFloat(optionResult.PremiumTotal || 0);
                });
            }
            
            // If IMS didn't return a premium but we calculated one, use that
            if (totalPremium === 0 && calculatedPremium) {
                console.log(`IMS returned no premium, using calculated premium: $${calculatedPremium}`);
                totalPremium = calculatedPremium;
            }
            
            // Log diagnostic info if no premium found
            if (totalPremium === 0) {
                console.warn('\n⚠️  NO PREMIUM CALCULATED!');
                console.warn('Possible reasons:');
                console.warn('1. No Quote Options were created (check CompanyLine configuration)');
                console.warn('2. Excel formulas failed to calculate');
                console.warn('3. Premium cell location not configured correctly');
                console.warn('4. Rating type not associated with the quote');
                console.warn('\nNext steps:');
                console.warn('- Check the quote in IMS UI');
                console.warn('- Verify CompanyLine has proper Line/State configuration');
                console.warn('- Ensure the rating type matches the Excel template');
            }
            
            return {
                premium: totalPremium,
                raterResults: {
                    success: importResult.Success,
                    premium: totalPremium,
                    premiums: importResult.Premiums,
                    calculatedPremium: calculatedPremium,
                    calculatedAt: new Date().toISOString(),
                    method: 'ImportExcelRater',
                    diagnostics: {
                        quoteOptionsCreated: quoteOptions.length,
                        excelFormulaErrors: processedBuffer ? 'Some formulas had errors' : 'No formula calculation',
                        premiumFound: totalPremium > 0
                    }
                }
            };
            
        } catch (importError) {
            console.error('ImportExcelRater failed:', importError.message);
            
            // Fallback: Save rating sheet and try to extract premium from Excel
            console.log('Attempting fallback: SaveRatingSheet...');
            try {
                await this.imsService.saveRatingSheet(
                    quoteGuid,
                    submission.ims_rating_type_id || 0,
                    processedBase64,
                    submission.rater_file_name
                );
                
                console.log('Rating sheet saved successfully');
                
                // Try to extract premium from a known cell or use calculated premium
                const premium = calculatedPremium || null;  // Old extraction method removed
                
                // If we have quote options and a premium, add it manually
                if (premium && quoteOptions.length > 0) {
                    const firstOption = quoteOptions[0];
                    console.log(`Adding premium ${premium} to quote option ${firstOption.QuoteOptionGuid}`);
                    
                    await this.imsService.addPremium(
                        firstOption.QuoteOptionGuid,
                        premium,
                        -1, // Use default office
                        1   // Default charge code
                    );
                    
                    return {
                        premium: premium,
                        raterResults: {
                            success: true,
                            premium: premium,
                            calculatedAt: new Date().toISOString(),
                            method: 'SaveRatingSheet + AddPremium'
                        }
                    };
                } else if (!premium) {
                    console.warn('Could not extract premium from Excel file');
                    // Return without premium - underwriter can rate manually
                    return {
                        premium: null,
                        raterResults: {
                            success: false,
                            errorMessage: 'Could not extract premium from Excel',
                            calculatedAt: new Date().toISOString(),
                            method: 'SaveRatingSheet'
                        }
                    };
                } else {
                    console.warn('No quote options available to add premium to');
                    return {
                        premium: premium,
                        raterResults: {
                            success: true,
                            premium: premium,
                            calculatedAt: new Date().toISOString(),
                            method: 'SaveRatingSheet (no options)'
                        }
                    };
                }
                
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                // Don't throw - allow submission to continue without premium
                return {
                    premium: null,
                    raterResults: {
                        success: false,
                        errorMessage: `Import failed: ${importError.message}, Fallback failed: ${fallbackError.message}`,
                        calculatedAt: new Date().toISOString(),
                        method: 'Failed'
                    }
                };
            }
        }
    }
    
    getBusinessTypeName(businessTypeId) {
        const businessTypes = {
            '2': 'Partnership',
            '3': 'Limited Partnership',
            '4': 'Individual',
            '5': 'Other',
            '9': 'LLC/LLP',
            '10': 'Joint Venture',
            '11': 'Trust',
            '13': 'Corporation'
        };
        return businessTypes[businessTypeId] || 'Other';
    }
    
    flattenCustomData(customData) {
        const flattened = {};
        if (customData && typeof customData === 'object') {
            Object.keys(customData).forEach(key => {
                const value = customData[key];
                // Convert field names to Excel-friendly format
                const excelKey = key.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
                flattened[excelKey] = value || '';
            });
        }
        return flattened;
    }
    
    async getPremiumMappings(lobId, client) {
        try {
            const result = await client.query(`
                SELECT sheet_name, cell_reference, mapping_type, description
                FROM excel_premium_mappings
                WHERE lob_id = $1 AND mapping_type = 'premium'
                ORDER BY priority ASC
            `, [lobId]);
            
            if (result.rows.length > 0) {
                console.log(`Found ${result.rows.length} premium mappings for LOB ${lobId}`);
                return result.rows;
            }
        } catch (error) {
            console.warn('Could not fetch premium mappings:', error.message);
        }
        
        // Return default mappings if none found or error
        return [
            { sheet_name: 'IMS_TAGS', cell_reference: 'B6' },
            { sheet_name: 'Summary', cell_reference: 'B6' },
            { sheet_name: 'Premium', cell_reference: 'B10' },
            { sheet_name: 'Rating', cell_reference: 'E15' },
            { sheet_name: 'submission_data', cell_reference: 'B50' }
        ];
    }
    
    async populateAndSaveExcelRater(submission, quoteGuid, imsData, customData) {
        console.log('\n=== Populating and Saving Excel Rater ===');
        
        const originalBuffer = Buffer.from(submission.rater_file_data, 'base64');
        
        try {
            // Format dates
            const effectiveDate = new Date().toISOString().split('T')[0];
            const expirationDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
            
            // Create cell mappings for submission_data sheet
            const cellMapping = this.minimalEditor.createSubmissionDataMapping(
                imsData, 
                customData, 
                effectiveDate, 
                expirationDate
            );
            
            console.log(`Populating ${Object.keys(cellMapping).length} cells in submission_data sheet`);
            
            // Populate the Excel file using minimal editor (preserves formatting)
            let processedBuffer = await this.minimalEditor.populateCells(
                originalBuffer,
                cellMapping,
                'submission_data'
            );
            
            // Now handle formula calculation based on selected method
            const calcMethod = submission.formula_calc_method || 'none';
            console.log(`\nFormula calculation method: ${calcMethod}`);
            
            if (calcMethod !== 'none') {
                try {
                    switch (calcMethod) {
                        case 'python':
                            console.log('Using Python/openpyxl for formula calculation...');
                            processedBuffer = await this.formulaExecutor.calculateFormulas(processedBuffer, {
                                ...imsData,
                                ...customData,
                                effectiveDate,
                                expirationDate,
                                cell_mappings: cellMapping
                            });
                            break;
                            
                        case 'excel_com':
                            console.log('Using Excel COM automation for formula calculation...');
                            if (await this.excelComCalculator.checkAvailability()) {
                                processedBuffer = await this.excelComCalculator.calculateFormulas(processedBuffer, cellMapping);
                            } else {
                                console.warn('Excel COM not available, skipping formula calculation');
                            }
                            break;
                            
                        case 'libreoffice':
                            console.log('Using LibreOffice for formula calculation...');
                            if (await this.libreOfficeCalculator.checkAvailability()) {
                                processedBuffer = await this.libreOfficeCalculator.calculateFormulas(processedBuffer, cellMapping);
                            } else {
                                console.warn('LibreOffice not available, skipping formula calculation');
                                console.log(this.libreOfficeCalculator.getInstallInstructions());
                            }
                            break;
                            
                        default:
                            console.warn(`Unknown calculation method: ${calcMethod}`);
                    }
                } catch (calcError) {
                    console.error(`Formula calculation failed (${calcMethod}):`, calcError.message);
                    console.log('Continuing with uncalculated formulas...');
                }
            }
            
            // Convert to base64 for IMS
            const processedBase64 = processedBuffer.toString('base64');
            
            // Save the rating sheet
            console.log('\nSaving populated Excel rating sheet to IMS...');
            try {
                const saveResult = await this.imsService.saveRatingSheet(
                    quoteGuid,
                    submission.ims_rating_type_id || 0,
                    processedBase64,
                    submission.rater_file_name
                );
                console.log('Rating sheet saved successfully');
                
                // Try to import the Excel rater to populate data in IMS
                console.log('\nImporting Excel rater to IMS to populate data...');
                let importSuccess = false;
                try {
                    const importResult = await this.imsService.importExcelRater(
                        quoteGuid,
                        processedBase64,
                        submission.rater_file_name,
                        submission.ims_rating_type_id || 0,
                        null,
                        true
                    );
                    
                    console.log('Import result:', JSON.stringify(importResult, null, 2));
                    importSuccess = importResult.Success || false;
                    
                    if (importResult.Success) {
                        console.log('✓ Excel data successfully imported to IMS');
                    } else {
                        console.log('⚠️ ImportExcelRater returned success=false');
                        if (importResult.Message) {
                            console.log('Message:', importResult.Message);
                        }
                    }
                } catch (importError) {
                    console.warn('ImportExcelRater failed:', importError.message);
                    console.log('This is expected if quote options haven\'t been created yet');
                    // Continue - we'll create options and run stored procedure next
                }
                
                return {
                    processedBuffer,
                    raterResults: {
                        success: true,
                        savedToIMS: true,
                        dataImported: importSuccess,
                        ratingTypeId: submission.ims_rating_type_id || 0,
                        fileName: submission.rater_file_name,
                        calculatedAt: new Date().toISOString(),
                        method: 'PopulateAndSave',
                        formulaCalculation: calcMethod,
                        preservedFormatting: true
                    }
                };
            } catch (saveError) {
                console.error('Could not save rating sheet:', saveError.message);
                throw saveError;
            }
            
        } catch (error) {
            console.error('Failed to populate and save Excel rater:', error);
            throw error;
        }
    }
    
    async extractPremiumFromExcel(processedBuffer, lobId) {
        console.log('\n--- Premium Extraction Details ---');
        console.log('LOB ID:', lobId);
        
        try {
            const client = await pool.connect();
            try {
                // Get premium mappings for this LOB
                const premiumMappings = await this.getPremiumMappings(lobId, client);
                console.log('Premium mappings found:', premiumMappings.length);
                premiumMappings.forEach((mapping, index) => {
                    console.log(`Mapping ${index + 1}: ${mapping.sheet_name}!${mapping.cell_reference} (priority: ${mapping.priority})`);
                });
                
                // Use xlsx to read the calculated file and extract premium
                const XLSX = require('xlsx');
                const workbook = XLSX.read(processedBuffer, { type: 'buffer' });
                console.log('\\nWorkbook sheets:', Object.keys(workbook.Sheets));
                
                // Check each configured location
                for (const mapping of premiumMappings) {
                    console.log(`\\nChecking ${mapping.sheet_name}!${mapping.cell_reference}...`);
                    
                    if (workbook.Sheets[mapping.sheet_name]) {
                        const sheet = workbook.Sheets[mapping.sheet_name];
                        const cell = sheet[mapping.cell_reference];
                        
                        if (cell) {
                            console.log(`Cell found:`, {
                                value: cell.v,
                                type: cell.t,
                                formula: cell.f,
                                raw: cell.w
                            });
                            
                            if (cell.v !== undefined) {
                                const value = parseFloat(cell.v);
                                console.log(`Parsed value: ${value}, isNaN: ${isNaN(value)}, > 0: ${value > 0}`);
                                
                                if (!isNaN(value) && value > 0) {
                                    console.log(`✓ Found valid premium: ${value} in ${mapping.sheet_name}!${mapping.cell_reference}`);
                                    return value;
                                }
                            } else {
                                console.log('Cell has no value (v) property');
                            }
                        } else {
                            console.log(`Cell ${mapping.cell_reference} not found in sheet`);
                        }
                    } else {
                        console.log(`Sheet '${mapping.sheet_name}' not found in workbook`);
                    }
                }
                
                console.warn('\\n✗ No premium found in any configured location');
                console.log('--- End Premium Extraction ---\\n');
                return null;
            } finally {
                client.release();
            }
        } catch (extractError) {
            console.error('\\n✗ Error extracting premium:', extractError.message);
            console.error('Stack:', extractError.stack);
            console.log('--- End Premium Extraction (Error) ---\\n');
            return null;
        }
    }

    async processExcelRaterMinimal(submission, quoteGuid, quoteOptions, imsData, customData, originalBuffer) {
        console.log('\n=== Using Minimal Excel Editor (preserves file integrity) ===');
        
        try {
            // Format dates
            const effectiveDate = new Date().toISOString().split('T')[0];
            const expirationDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
            
            // Create cell mappings for submission_data sheet
            const cellMapping = this.minimalEditor.createSubmissionDataMapping(
                imsData, 
                customData, 
                effectiveDate, 
                expirationDate
            );
            
            console.log(`Populating ${Object.keys(cellMapping).length} cells in submission_data sheet`);
            
            // Populate the Excel file using minimal editor (preserves formatting)
            let processedBuffer = await this.minimalEditor.populateCells(
                originalBuffer,
                cellMapping,
                'submission_data'
            );
            
            // Now handle formula calculation based on selected method
            const calcMethod = submission.formula_calc_method || 'none';
            console.log(`\nFormula calculation method: ${calcMethod}`);
            
            if (calcMethod !== 'none') {
                try {
                    switch (calcMethod) {
                        case 'python':
                            console.log('Using Python/openpyxl for formula calculation...');
                            processedBuffer = await this.formulaExecutor.calculateFormulas(processedBuffer, {
                                ...imsData,
                                ...customData,
                                effectiveDate,
                                expirationDate,
                                cell_mappings: cellMapping
                            });
                            break;
                            
                        case 'excel_com':
                            console.log('Using Excel COM automation for formula calculation...');
                            if (await this.excelComCalculator.checkAvailability()) {
                                processedBuffer = await this.excelComCalculator.calculateFormulas(processedBuffer, cellMapping);
                            } else {
                                console.warn('Excel COM not available, skipping formula calculation');
                            }
                            break;
                            
                        case 'libreoffice':
                            console.log('Using LibreOffice for formula calculation...');
                            if (await this.libreOfficeCalculator.checkAvailability()) {
                                processedBuffer = await this.libreOfficeCalculator.calculateFormulas(processedBuffer, cellMapping);
                            } else {
                                console.warn('LibreOffice not available, skipping formula calculation');
                                console.log(this.libreOfficeCalculator.getInstallInstructions());
                            }
                            break;
                            
                        default:
                            console.warn(`Unknown calculation method: ${calcMethod}`);
                    }
                } catch (calcError) {
                    console.error(`Formula calculation failed (${calcMethod}):`, calcError.message);
                    console.log('Continuing with uncalculated formulas...');
                }
            }
            
            // Convert to base64 for IMS
            const processedBase64 = processedBuffer.toString('base64');
            
            // Try to extract the premium from the calculated Excel
            let extractedPremium = null;
            if (calcMethod !== 'none') {
                try {
                    console.log('\nExtracting premium from calculated Excel...');
                    
                    // Get premium mappings for this LOB
                    const client = await pool.connect();
                    try {
                        const premiumMappings = await this.getPremiumMappings(submission.lob_id, client);
                        
                        // Use xlsx to read the calculated file and extract premium
                        const XLSX = require('xlsx');
                        const workbook = XLSX.read(processedBuffer, { type: 'buffer' });
                        
                        // Check each configured location
                        for (const mapping of premiumMappings) {
                            if (workbook.Sheets[mapping.sheet_name]) {
                                const sheet = workbook.Sheets[mapping.sheet_name];
                                const cell = sheet[mapping.cell_reference];
                                if (cell && cell.v !== undefined) {
                                    const value = parseFloat(cell.v);
                                    if (!isNaN(value) && value > 0) {
                                        console.log(`Found premium ${value} in ${mapping.sheet_name}!${mapping.cell_reference}`);
                                        extractedPremium = value;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (!extractedPremium) {
                            console.warn('No premium found in configured locations');
                        }
                    } finally {
                        client.release();
                    }
                } catch (extractError) {
                    console.error('Error extracting premium:', extractError.message);
                }
            }
            
            // Save the rating sheet
            console.log('\nSaving populated Excel rating sheet to IMS...');
            try {
                const saveResult = await this.imsService.saveRatingSheet(
                    quoteGuid,
                    submission.ims_rating_type_id || 0,
                    processedBase64,
                    submission.rater_file_name
                );
                console.log('Rating sheet saved successfully');
            } catch (saveError) {
                console.warn('Could not save rating sheet:', saveError.message);
            }
            
            // Import the Excel rater
            console.log('\nImporting Excel rater to IMS...');
            try {
                const importResult = await this.imsService.importExcelRater(
                    quoteGuid,
                    processedBase64,
                    submission.rater_file_name,
                    submission.ims_rating_type_id || 0,
                    null,
                    true
                );
                
                console.log('Import result:', JSON.stringify(importResult, null, 2));
                
                // Extract premium
                let totalPremium = 0;
                if (importResult.Success && importResult.Premiums && importResult.Premiums.length > 0) {
                    importResult.Premiums.forEach(optionResult => {
                        totalPremium += parseFloat(optionResult.PremiumTotal || 0);
                    });
                }
                
                // If ImportExcelRater failed but we extracted a premium, use that
                if (!importResult.Success && extractedPremium) {
                    console.log(`ImportExcelRater failed, but we extracted premium: ${extractedPremium}`);
                    totalPremium = extractedPremium;
                    
                    // If we have quote options, try to add the premium manually
                    if (quoteOptions && quoteOptions.length > 0) {
                        try {
                            console.log('Attempting to add premium manually to first quote option...');
                            const firstOption = quoteOptions[0];
                            await this.imsService.addPremium(
                                firstOption.QuoteOptionGuid,
                                extractedPremium,
                                -1, // Use default office
                                1   // Default charge code
                            );
                            console.log('Premium added successfully');
                        } catch (addPremiumError) {
                            console.error('Failed to add premium manually:', addPremiumError.message);
                        }
                    }
                }
                
                return {
                    premium: totalPremium || extractedPremium || 0,
                    raterResults: {
                        success: importResult.Success || (extractedPremium > 0),
                        premium: totalPremium || extractedPremium || 0,
                        premiums: importResult.Premiums,
                        extractedPremium: extractedPremium,
                        calculatedAt: new Date().toISOString(),
                        method: `MinimalEditor + ${calcMethod}`,
                        preservedFormatting: true,
                        formulaCalculation: calcMethod
                    }
                };
                
            } catch (importError) {
                console.error('ImportExcelRater failed:', importError.message);
                
                // Return without premium - let underwriter handle manually
                return {
                    premium: null,
                    raterResults: {
                        success: false,
                        errorMessage: importError.message,
                        calculatedAt: new Date().toISOString(),
                        method: `MinimalEditor + ${calcMethod}`,
                        preservedFormatting: true,
                        formulaCalculation: calcMethod
                    }
                };
            }
            
        } catch (error) {
            console.error('Minimal editor processing failed:', error);
            throw error;
        }
    }
    
    // DEPRECATED - DO NOT USE - This is the old method
    extractPremiumFromExcelOLD(workbook, premiumMappings = null) {
        // Use provided mappings or default common locations
        const locations = premiumMappings || [
            { sheet_name: 'IMS_TAGS', cell_reference: 'B6' },
            { sheet_name: 'Summary', cell_reference: 'B6' },
            { sheet_name: 'Premium', cell_reference: 'B10' },
            { sheet_name: 'Rating', cell_reference: 'E15' },
            { sheet_name: 'submission_data', cell_reference: 'B50' }
        ];
        
        console.log('Checking for premium in Excel:');
        for (const location of locations) {
            const sheet = workbook.getWorksheet(location.sheet_name);
            if (sheet) {
                const cell = sheet.getCell(location.cell_reference);
                if (cell && cell.value) {
                    const value = parseFloat(cell.value);
                    console.log(`  ${location.sheet_name}!${location.cell_reference}: ${cell.value}`);
                    if (!isNaN(value) && value > 0) {
                        console.log(`Found premium ${value} in ${location.sheet_name}!${location.cell_reference}`);
                        return value;
                    }
                }
            }
        }
        
        console.warn('Could not extract premium from Excel file');
        return null;
    }
}

module.exports = ProducerSubmissionProcessor;