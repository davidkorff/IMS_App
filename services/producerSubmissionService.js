const pool = require('../config/db');
const imsService = require('./imsService');
const dataAccess = require('./dataAccess');

class ProducerSubmissionService {
    /**
     * Process a producer submission through IMS
     * This handles the complete flow from submission to form attachment
     */
    async processSubmission(submissionData, lobConfig, instanceConfig) {
        try {
            // 1. Clear the insured
            const clearanceResult = await imsService.callProcedure('ClearInsuredAsXml', {
                insuredName: submissionData.insuredName,
                fein: submissionData.fein,
                ssn: submissionData.ssn
            }, instanceConfig);

            let insuredGuid;
            
            // 2. Create insured if needed
            if (!clearanceResult || clearanceResult.length === 0) {
                const insuredResult = await imsService.callProcedure('AddInsuredWithLocation', {
                    BusinessTypeID: submissionData.businessTypeId || 13, // Corporation
                    CorporationName: submissionData.insuredName,
                    NameOnPolicy: submissionData.nameOnPolicy || submissionData.insuredName,
                    Address1: submissionData.address1,
                    City: submissionData.city,
                    State: submissionData.state,
                    Zip: submissionData.zip,
                    LocationTypeID: 1, // Primary
                    DeliveryMethodID: 3 // Email
                }, instanceConfig);
                
                insuredGuid = insuredResult.InsuredGUID;
            } else {
                insuredGuid = clearanceResult[0].InsuredGUID;
            }

            // 3. Create submission
            const submissionResult = await imsService.callProcedure('AddSubmission', {
                Insured: insuredGuid,
                ProducerContact: submissionData.producerContactGuid,
                Underwriter: lobConfig.underwriter_guid,
                SubmissionDate: new Date()
            }, instanceConfig);

            // 4. Create quote with auto-calculate details
            const quoteResult = await imsService.callProcedure('AddQuoteWithAutoCalculateDetails', {
                Submission: submissionResult.SubmissionGroupGUID,
                QuotingLocation: lobConfig.quoting_location_guid,
                IssuingLocation: lobConfig.issuing_location_guid,
                CompanyLocation: lobConfig.ims_company_guid,
                Line: lobConfig.ims_line_guid,
                StateID: submissionData.state,
                ProducerContact: submissionData.producerContactGuid,
                QuoteStatusID: 1, // Submitted
                Effective: submissionData.effectiveDate,
                Expiration: submissionData.expirationDate,
                BillingTypeID: submissionData.billingTypeId || 2, // Direct Bill MGA
                Underwriter: lobConfig.underwriter_guid,
                PolicyTypeID: 1, // New
                CostCenterID: 0
            }, instanceConfig);

            const quoteGuid = quoteResult.QuoteGUID;

            // 5. Call custom stored procedure if configured
            if (lobConfig.ims_procedure_name) {
                // Strip _WS suffix if present (DataAccess will add it back)
                let procedureName = lobConfig.ims_procedure_name;
                if (procedureName.endsWith('_WS')) {
                    procedureName = procedureName.slice(0, -3);
                }

                // Call the custom procedure with quote GUID
                await dataAccess.executeProc({
                    url: instanceConfig.url,
                    username: instanceConfig.username,
                    password: instanceConfig.password,
                    procedure: procedureName,
                    parameters: {
                        QuoteGUID: quoteGuid,
                        // Pass any additional submission data that might be needed
                        SubmissionData: JSON.stringify(submissionData)
                    }
                });
            }

            // 6. Apply policy forms (this triggers IMS form attachment logic)
            await imsService.callProcedure('ApplyPolicyForms', {
                quoteGuid: quoteGuid
            }, instanceConfig);

            // 7. Import Excel rater if provided
            if (submissionData.raterData) {
                await imsService.callProcedure('ImportExcelRater', {
                    QuoteGuid: quoteGuid,
                    RaterData: submissionData.raterData
                }, instanceConfig);
            }

            return {
                success: true,
                quoteGuid: quoteGuid,
                submissionGuid: submissionResult.SubmissionGroupGUID,
                insuredGuid: insuredGuid
            };

        } catch (error) {
            console.error('Error processing submission:', error);
            throw error;
        }
    }

    /**
     * Save submission to local database
     */
    async saveSubmission(producerId, submissionData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Save to custom_route_submissions first
            const submissionResult = await client.query(`
                INSERT INTO custom_route_submissions (
                    route_id, instance_id, form_data, 
                    submission_status, created_at
                ) VALUES (
                    $1, $2, $3, 'draft', CURRENT_TIMESTAMP
                ) RETURNING submission_id
            `, [
                submissionData.routeId,
                submissionData.instanceId,
                JSON.stringify(submissionData.formData)
            ]);

            const submissionId = submissionResult.rows[0].submission_id;

            // Link to producer
            await client.query(`
                INSERT INTO producer_submissions (
                    submission_id, producer_id, created_at
                ) VALUES ($1, $2, CURRENT_TIMESTAMP)
            `, [submissionId, producerId]);

            await client.query('COMMIT');

            return submissionId;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get submissions for a producer
     */
    async getProducerSubmissions(producerId, instanceId) {
        const result = await pool.query(`
            SELECT 
                s.submission_id,
                s.form_data,
                s.submission_status,
                s.created_at,
                s.updated_at,
                s.ims_quote_guid,
                s.ims_policy_number,
                cr.route_name,
                lob.line_name
            FROM producer_submissions ps
            JOIN custom_route_submissions s ON ps.submission_id = s.submission_id
            LEFT JOIN custom_routes cr ON s.route_id = cr.route_id
            LEFT JOIN portal_lines_of_business lob ON cr.lob_id = lob.lob_id
            WHERE ps.producer_id = $1 AND s.instance_id = $2
            ORDER BY s.created_at DESC
        `, [producerId, instanceId]);

        return result.rows;
    }
}

module.exports = new ProducerSubmissionService();