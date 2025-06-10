const { Pool } = require('pg');
const dataAccess = require('./dataAccess');
const submissionService = require('./submissionService');
const insuredService = require('./insuredService');
const producerService = require('./producerService');
const documentService = require('./documentService');

class CustomRoutesService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    // ================ ROUTE MANAGEMENT ================

    async createRoute(instanceId, routeData) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO custom_routes (
                    instance_id, name, description, slug, form_config, 
                    workflow_config, ims_config, rater_config
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                instanceId,
                routeData.name,
                routeData.description,
                routeData.slug,
                JSON.stringify(routeData.formConfig || {}),
                JSON.stringify(routeData.workflowConfig || {}),
                JSON.stringify(routeData.imsConfig || {}),
                routeData.raterConfig ? JSON.stringify(routeData.raterConfig) : null
            ]);

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async getRoutes(instanceId, includeInactive = false) {
        const client = await this.pool.connect();
        try {
            const whereClause = includeInactive 
                ? 'WHERE instance_id = $1' 
                : 'WHERE instance_id = $1 AND is_active = true';
            
            const result = await client.query(`
                SELECT * FROM custom_routes 
                ${whereClause}
                ORDER BY created_at DESC
            `, [instanceId]);

            return result.rows;
        } finally {
            client.release();
        }
    }

    async getRoute(routeId, instanceId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT r.*, 
                       COALESCE(
                           json_agg(
                               json_build_object(
                                   'field_id', f.field_id,
                                   'field_name', f.field_name,
                                   'field_type', f.field_type,
                                   'field_label', f.field_label,
                                   'field_config', f.field_config,
                                   'step_number', f.step_number,
                                   'field_order', f.field_order,
                                   'ims_field_mapping', f.ims_field_mapping,
                                   'rater_cell_mapping', f.rater_cell_mapping,
                                   'is_required', f.is_required,
                                   'is_conditional', f.is_conditional,
                                   'conditional_logic', f.conditional_logic
                               ) ORDER BY f.step_number, f.field_order
                           ) FILTER (WHERE f.field_id IS NOT NULL), 
                           '[]'
                       ) as fields
                FROM custom_routes r
                LEFT JOIN custom_route_fields f ON r.route_id = f.route_id
                WHERE r.route_id = $1 AND r.instance_id = $2
                GROUP BY r.route_id
            `, [routeId, instanceId]);

            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async updateRoute(routeId, instanceId, updateData) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                UPDATE custom_routes 
                SET name = COALESCE($3, name),
                    description = COALESCE($4, description),
                    form_config = COALESCE($5, form_config),
                    workflow_config = COALESCE($6, workflow_config),
                    ims_config = COALESCE($7, ims_config),
                    rater_config = COALESCE($8, rater_config),
                    is_active = COALESCE($9, is_active),
                    updated_at = CURRENT_TIMESTAMP
                WHERE route_id = $1 AND instance_id = $2
                RETURNING *
            `, [
                routeId, instanceId,
                updateData.name,
                updateData.description,
                updateData.formConfig ? JSON.stringify(updateData.formConfig) : null,
                updateData.workflowConfig ? JSON.stringify(updateData.workflowConfig) : null,
                updateData.imsConfig ? JSON.stringify(updateData.imsConfig) : null,
                updateData.raterConfig ? JSON.stringify(updateData.raterConfig) : null,
                updateData.isActive
            ]);

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    // ================ FIELD MANAGEMENT ================

    async addField(routeId, fieldData) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO custom_route_fields (
                    route_id, field_name, field_type, field_label, field_config,
                    step_number, field_order, ims_field_mapping, rater_cell_mapping,
                    is_required, is_conditional, conditional_logic
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `, [
                routeId,
                fieldData.fieldName,
                fieldData.fieldType,
                fieldData.fieldLabel,
                JSON.stringify(fieldData.fieldConfig || {}),
                fieldData.stepNumber || 1,
                fieldData.fieldOrder || 0,
                fieldData.imsFieldMapping,
                fieldData.raterCellMapping,
                fieldData.isRequired || false,
                fieldData.isConditional || false,
                fieldData.conditionalLogic ? JSON.stringify(fieldData.conditionalLogic) : null
            ]);

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async updateField(fieldId, updateData) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                UPDATE custom_route_fields 
                SET field_name = COALESCE($2, field_name),
                    field_type = COALESCE($3, field_type),
                    field_label = COALESCE($4, field_label),
                    field_config = COALESCE($5, field_config),
                    step_number = COALESCE($6, step_number),
                    field_order = COALESCE($7, field_order),
                    ims_field_mapping = COALESCE($8, ims_field_mapping),
                    rater_cell_mapping = COALESCE($9, rater_cell_mapping),
                    is_required = COALESCE($10, is_required),
                    is_conditional = COALESCE($11, is_conditional),
                    conditional_logic = COALESCE($12, conditional_logic),
                    updated_at = CURRENT_TIMESTAMP
                WHERE field_id = $1
                RETURNING *
            `, [
                fieldId,
                updateData.fieldName,
                updateData.fieldType,
                updateData.fieldLabel,
                updateData.fieldConfig ? JSON.stringify(updateData.fieldConfig) : null,
                updateData.stepNumber,
                updateData.fieldOrder,
                updateData.imsFieldMapping,
                updateData.raterCellMapping,
                updateData.isRequired,
                updateData.isConditional,
                updateData.conditionalLogic ? JSON.stringify(updateData.conditionalLogic) : null
            ]);

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async deleteField(fieldId) {
        const client = await this.pool.connect();
        try {
            await client.query('DELETE FROM custom_route_fields WHERE field_id = $1', [fieldId]);
            return { success: true };
        } finally {
            client.release();
        }
    }

    // ================ SUBMISSION PROCESSING ================

    async createSubmission(routeId, submissionData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Create the submission record
            const submissionResult = await client.query(`
                INSERT INTO custom_route_submissions (
                    route_id, applicant_email, applicant_name, form_data, 
                    status, workflow_step
                ) VALUES ($1, $2, $3, $4, 'submitted', 'initial')
                RETURNING *
            `, [
                routeId,
                submissionData.applicantEmail,
                submissionData.applicantName,
                JSON.stringify(submissionData.formData)
            ]);

            const submission = submissionResult.rows[0];

            // Log the initial submission
            await this.logWorkflowAction(
                submission.submission_id,
                'submitted',
                null,
                'submitted',
                'system',
                'Form submitted by applicant'
            );

            // Update route submission count
            await client.query(`
                UPDATE custom_routes 
                SET submission_count = submission_count + 1 
                WHERE route_id = $1
            `, [routeId]);

            await client.query('COMMIT');
            return submission;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async processSubmission(submissionId, imsCredentials) {
        const client = await this.pool.connect();
        try {
            // Get submission with route configuration
            const submissionResult = await client.query(`
                SELECT s.*, r.ims_config, r.workflow_config, r.name as route_name
                FROM custom_route_submissions s
                JOIN custom_routes r ON s.route_id = r.route_id
                WHERE s.submission_id = $1
            `, [submissionId]);

            const submission = submissionResult.rows[0];
            if (!submission) {
                throw new Error('Submission not found');
            }

            // Update status to processing
            await this.updateSubmissionStatus(submissionId, 'processing', 'ims_integration');

            // Extract form data
            const formData = submission.form_data;
            
            // Step 1: Create or find insured
            const insuredData = this.extractInsuredData(formData);
            let insuredGuid;
            
            // Perform clearance check first
            const clearanceResults = await this.performClearanceCheck(insuredData, imsCredentials);
            
            if (clearanceResults.length > 0) {
                // Found existing insured
                insuredGuid = clearanceResults[0].InsuredGuid;
                await this.logWorkflowAction(
                    submissionId,
                    'clearance_found',
                    'processing',
                    'processing',
                    'system',
                    `Found existing insured: ${clearanceResults[0].NameOnPolicy}`
                );
            } else {
                // Create new insured
                insuredGuid = await this.createInsured(insuredData, imsCredentials);
                await this.logWorkflowAction(
                    submissionId,
                    'insured_created',
                    'processing',
                    'processing',
                    'system',
                    `Created new insured with GUID: ${insuredGuid}`
                );
            }

            // Step 2: Create submission in IMS
            const submissionData = this.extractSubmissionData(formData, insuredGuid);
            const imsSubmissionGuid = await this.createIMSSubmission(submissionData, imsCredentials);
            
            await this.logWorkflowAction(
                submissionId,
                'ims_submission_created',
                'processing',
                'processing',
                'system',
                `IMS submission created: ${imsSubmissionGuid}`
            );

            // Step 3: Create quote
            const quoteData = this.extractQuoteData(formData, imsSubmissionGuid);
            const imsQuoteGuid = await this.createIMSQuote(quoteData, imsCredentials);

            // Update submission with IMS GUIDs
            await client.query(`
                UPDATE custom_route_submissions 
                SET ims_submission_guid = $1, ims_quote_guid = $2, status = 'quoted',
                    workflow_step = 'quote_created', processed_at = CURRENT_TIMESTAMP
                WHERE submission_id = $3
            `, [imsSubmissionGuid, imsQuoteGuid, submissionId]);

            await this.logWorkflowAction(
                submissionId,
                'quote_created',
                'processing',
                'quoted',
                'system',
                `IMS quote created: ${imsQuoteGuid}`
            );

            return {
                success: true,
                insuredGuid,
                submissionGuid: imsSubmissionGuid,
                quoteGuid: imsQuoteGuid
            };

        } catch (error) {
            await this.updateSubmissionStatus(submissionId, 'error', 'processing_failed');
            await this.logWorkflowAction(
                submissionId,
                'processing_error',
                'processing',
                'error',
                'system',
                `Processing failed: ${error.message}`
            );
            throw error;
        } finally {
            client.release();
        }
    }

    // ================ IMS INTEGRATION HELPERS ================

    async performClearanceCheck(insuredData, imsCredentials) {
        try {
            const result = await dataAccess.executeWebMethod({
                url: imsCredentials.url,
                username: imsCredentials.username,
                password: imsCredentials.password,
                webservice: 'ProducerFunctions',
                method: 'ClearInsuredAsXml',
                parameters: {
                    clearanceXml: this.buildClearanceXml(insuredData)
                }
            });

            return this.parseClearanceResults(result);
        } catch (error) {
            console.error('Clearance check failed:', error);
            return [];
        }
    }

    async createInsured(insuredData, imsCredentials) {
        const result = await dataAccess.executeWebMethod({
            url: imsCredentials.url,
            username: imsCredentials.username,
            password: imsCredentials.password,
            webservice: 'InsuredFunctions',
            method: 'AddInsuredWithLocation',
            parameters: this.buildInsuredXml(insuredData)
        });

        return result; // Returns GUID
    }

    async createIMSSubmission(submissionData, imsCredentials) {
        return await submissionService.addSubmission(
            imsCredentials.url,
            await dataAccess.getLoginToken(imsCredentials),
            submissionData
        );
    }

    async createIMSQuote(quoteData, imsCredentials) {
        const result = await dataAccess.executeWebMethod({
            url: imsCredentials.url,
            username: imsCredentials.username,
            password: imsCredentials.password,
            webservice: 'QuoteFunctions',
            method: 'AddQuoteWithAutoCalculateDetails',
            parameters: this.buildQuoteXml(quoteData)
        });

        return result; // Returns quote GUID
    }

    // ================ DATA EXTRACTION HELPERS ================

    extractInsuredData(formData) {
        return {
            businessTypeId: formData.businessType || 2,
            nameOnPolicy: formData.companyName || `${formData.firstName} ${formData.lastName}`,
            lastName: formData.lastName,
            corporationName: formData.companyName,
            address1: formData.address1,
            address2: formData.address2,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            phone: formData.phone,
            email: formData.email,
            fein: formData.fein || formData.ein,
            ssn: formData.ssn
        };
    }

    extractSubmissionData(formData, insuredGuid) {
        return {
            insuredGuid,
            producerContactGuid: formData.producerContactGuid,
            underwriterGuid: formData.underwriterGuid,
            producerLocationGuid: formData.producerLocationGuid,
            tacsrGuid: formData.tacsrGuid,
            inHouseProducerGuid: formData.inHouseProducerGuid
        };
    }

    extractQuoteData(formData, submissionGuid) {
        return {
            submission: submissionGuid,
            quotingLocation: formData.quotingLocation,
            issuingLocation: formData.issuingLocation,
            companyLocation: formData.companyLocation,
            line: formData.line,
            stateId: formData.stateId,
            producerContact: formData.producerContactGuid,
            underwriter: formData.underwriterGuid,
            effective: formData.effectiveDate,
            expiration: formData.expirationDate,
            billingTypeId: formData.billingTypeId || 1,
            policyTypeId: formData.policyTypeId || 1
        };
    }

    // ================ XML BUILDERS ================

    buildClearanceXml(insuredData) {
        return `
            <Clearance>
                <NameOnPolicy>${insuredData.nameOnPolicy}</NameOnPolicy>
                <Address1>${insuredData.address1}</Address1>
                <City>${insuredData.city}</City>
                <State>${insuredData.state}</State>
                <Zip>${insuredData.zip}</Zip>
                ${insuredData.fein ? `<FEIN>${insuredData.fein}</FEIN>` : ''}
                ${insuredData.ssn ? `<SSN>${insuredData.ssn}</SSN>` : ''}
            </Clearance>
        `;
    }

    buildInsuredXml(insuredData) {
        const isIndividual = !insuredData.corporationName;
        
        return {
            insuredXml: `
                <Insured>
                    <BusinessTypeID>${insuredData.businessTypeId}</BusinessTypeID>
                    <NameOnPolicy>${insuredData.nameOnPolicy}</NameOnPolicy>
                    ${isIndividual ? `<LastName>${insuredData.lastName}</LastName>` : `<CorporationName>${insuredData.corporationName}</CorporationName>`}
                    ${insuredData.fein ? `<FEIN>${insuredData.fein}</FEIN>` : ''}
                    ${insuredData.ssn ? `<SSN>${insuredData.ssn}</SSN>` : ''}
                    <DeliveryMethodID>3</DeliveryMethodID>
                </Insured>
            `,
            locationXml: `
                <Location>
                    <Address1>${insuredData.address1}</Address1>
                    ${insuredData.address2 ? `<Address2>${insuredData.address2}</Address2>` : ''}
                    <City>${insuredData.city}</City>
                    <State>${insuredData.state}</State>
                    <Zip>${insuredData.zip}</Zip>
                    <ISOCountryCode>USA</ISOCountryCode>
                    <LocationTypeID>1</LocationTypeID>
                    ${insuredData.phone ? `<Phone>${insuredData.phone}</Phone>` : ''}
                    ${insuredData.email ? `<Email>${insuredData.email}</Email>` : ''}
                </Location>
            `
        };
    }

    buildQuoteXml(quoteData) {
        return {
            quoteXml: `
                <Quote>
                    <Submission>${quoteData.submission}</Submission>
                    <QuotingLocation>${quoteData.quotingLocation}</QuotingLocation>
                    <IssuingLocation>${quoteData.issuingLocation}</IssuingLocation>
                    <CompanyLocation>${quoteData.companyLocation}</CompanyLocation>
                    <Line>${quoteData.line}</Line>
                    <StateID>${quoteData.stateId}</StateID>
                    <ProducerContact>${quoteData.producerContact}</ProducerContact>
                    <Underwriter>${quoteData.underwriter}</Underwriter>
                    <QuoteStatusID>1</QuoteStatusID>
                    <Effective>${quoteData.effective}</Effective>
                    <Expiration>${quoteData.expiration}</Expiration>
                    <BillingTypeID>${quoteData.billingTypeId}</BillingTypeID>
                    <PolicyTypeID>${quoteData.policyTypeId}</PolicyTypeID>
                </Quote>
            `
        };
    }

    // ================ UTILITY METHODS ================

    async getRouteBySlug(slug) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT r.*, 
                       COALESCE(
                           json_agg(
                               json_build_object(
                                   'field_id', f.field_id,
                                   'field_name', f.field_name,
                                   'field_type', f.field_type,
                                   'field_label', f.field_label,
                                   'field_config', f.field_config,
                                   'step_number', f.step_number,
                                   'field_order', f.field_order,
                                   'ims_field_mapping', f.ims_field_mapping,
                                   'rater_cell_mapping', f.rater_cell_mapping,
                                   'is_required', f.is_required,
                                   'is_conditional', f.is_conditional,
                                   'conditional_logic', f.conditional_logic
                               ) ORDER BY f.step_number, f.field_order
                           ) FILTER (WHERE f.field_id IS NOT NULL), 
                           '[]'
                       ) as fields
                FROM custom_routes r
                LEFT JOIN custom_route_fields f ON r.route_id = f.route_id
                WHERE r.slug = $1
                GROUP BY r.route_id
            `, [slug]);

            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async getSubmissionByUUID(uuid) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT s.*, r.name as route_name, r.instance_id
                FROM custom_route_submissions s
                JOIN custom_routes r ON s.route_id = r.route_id
                WHERE s.submission_uuid = $1
            `, [uuid]);

            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async updateSubmissionStatus(submissionId, status, workflowStep) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                UPDATE custom_route_submissions 
                SET status = $1, workflow_step = $2, updated_at = CURRENT_TIMESTAMP
                WHERE submission_id = $3
            `, [status, workflowStep, submissionId]);
        } finally {
            client.release();
        }
    }

    async logWorkflowAction(submissionId, action, statusFrom, statusTo, actor, notes, actionData = null) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO custom_route_workflow_log 
                (submission_id, action, status_from, status_to, actor, notes, action_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [submissionId, action, statusFrom, statusTo, actor, notes, actionData ? JSON.stringify(actionData) : null]);
        } finally {
            client.release();
        }
    }

    async getSubmissions(routeId, status = null) {
        const client = await this.pool.connect();
        try {
            const whereClause = status 
                ? 'WHERE route_id = $1 AND status = $2'
                : 'WHERE route_id = $1';
            const params = status ? [routeId, status] : [routeId];
            
            const result = await client.query(`
                SELECT * FROM custom_route_submissions 
                ${whereClause}
                ORDER BY submitted_at DESC
            `, params);

            return result.rows;
        } finally {
            client.release();
        }
    }

    async getSubmission(submissionId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT s.*, r.name as route_name, r.ims_config, r.workflow_config
                FROM custom_route_submissions s
                JOIN custom_routes r ON s.route_id = r.route_id
                WHERE s.submission_id = $1
            `, [submissionId]);

            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async getWorkflowLog(submissionId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM custom_route_workflow_log 
                WHERE submission_id = $1 
                ORDER BY created_at ASC
            `, [submissionId]);

            return result.rows;
        } finally {
            client.release();
        }
    }

    // ================ IMS CONFIGURATION CACHING ================

    async getIMSConfiguration(instanceId, configType, imsCredentials) {
        const client = await this.pool.connect();
        try {
            // Check cache first
            const cacheResult = await client.query(`
                SELECT config_data FROM ims_configuration_cache 
                WHERE instance_id = $1 AND config_type = $2 AND expires_at > CURRENT_TIMESTAMP
            `, [instanceId, configType]);

            if (cacheResult.rows.length > 0) {
                return cacheResult.rows[0].config_data;
            }

            // Cache miss - fetch from IMS
            let configData;
            switch (configType) {
                case 'company_lines':
                    configData = await this.fetchCompanyLines(imsCredentials);
                    break;
                case 'business_types':
                    configData = await this.fetchBusinessTypes(imsCredentials);
                    break;
                default:
                    throw new Error(`Unknown config type: ${configType}`);
            }

            // Cache the result
            await client.query(`
                INSERT INTO ims_configuration_cache (instance_id, config_type, config_data)
                VALUES ($1, $2, $3)
                ON CONFLICT (instance_id, config_type) 
                DO UPDATE SET config_data = $3, updated_at = CURRENT_TIMESTAMP, expires_at = CURRENT_TIMESTAMP + INTERVAL '1 hour'
            `, [instanceId, configType, JSON.stringify(configData)]);

            return configData;
        } finally {
            client.release();
        }
    }

    async fetchCompanyLines(imsCredentials) {
        const result = await dataAccess.executeProc({
            url: imsCredentials.url,
            username: imsCredentials.username,
            password: imsCredentials.password,
            procedure: 'ValidCompanyLinesXml'
        });

        return result;
    }

    async fetchBusinessTypes(imsCredentials) {
        const result = await dataAccess.executeProc({
            url: imsCredentials.url,
            username: imsCredentials.username,
            password: imsCredentials.password,
            procedure: 'GetBusinessTypes'
        });

        return result;
    }

    parseClearanceResults(xmlResult) {
        // Parse the XML clearance results into structured data
        // This would need to be implemented based on the actual XML structure
        // returned by the ClearInsuredAsXml method
        try {
            if (!xmlResult || !xmlResult.Insured) {
                return [];
            }

            const insureds = Array.isArray(xmlResult.Insured) 
                ? xmlResult.Insured 
                : [xmlResult.Insured];

            return insureds.map(insured => ({
                InsuredGuid: insured.InsuredGuid,
                NameOnPolicy: insured.NameOnPolicy,
                Address: insured.Address,
                StatusID: insured.StatusID
            }));
        } catch (error) {
            console.error('Error parsing clearance results:', error);
            return [];
        }
    }
}

module.exports = new CustomRoutesService();