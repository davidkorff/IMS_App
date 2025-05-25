const pool = require('../config/db');
const authService = require('./authService');
const documentService = require('./documentService');
const usageTrackingService = require('./usageTrackingService');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class EmailFilingService {
    constructor() {
        this.defaultControlNumberPatterns = [
            /^(?:RE:\s*)?(\d{1,9})\b/i,     // Control number at start of subject (1-9 digits), optionally preceded by "RE:"
            /\b(\d{1,9})\b/g               // Fallback: any 1-9 digit number in email content
        ];
    }

    async createEmailFilingConfig(userId, instanceId, configData) {
        try {
            const webhookSecret = this.generateWebhookSecret();
            
            const result = await pool.query(`
                INSERT INTO email_filing_configs 
                (user_id, instance_id, name, webhook_secret, default_folder_id, 
                 auto_extract_control_numbers, control_number_patterns, 
                 file_email_as_pdf, include_attachments, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                userId,
                instanceId,
                configData.name,
                webhookSecret,
                configData.defaultFolderId || null,
                configData.autoExtractControlNumbers !== false,
                configData.controlNumberPatterns || this.defaultControlNumberPatterns.map(p => p.source).join('\n'),
                configData.fileEmailAsPdf !== false,
                configData.includeAttachments !== false,
                configData.isActive !== false
            ]);

            return result.rows[0];
        } catch (error) {
            console.error('Error creating email filing config:', error);
            throw error;
        }
    }

    async getEmailFilingConfigs(userId, instanceId = null) {
        try {
            let query = `
                SELECT efc.*, ii.name as instance_name, ii.url as instance_url
                FROM email_filing_configs efc
                JOIN ims_instances ii ON efc.instance_id = ii.instance_id
                WHERE efc.user_id = $1
            `;
            let params = [userId];

            if (instanceId) {
                query += ' AND efc.instance_id = $2';
                params.push(instanceId);
            }

            query += ' ORDER BY efc.created_at DESC';

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error getting email filing configs:', error);
            throw error;
        }
    }

    async processIncomingEmail(configId, emailData) {
        let logId = null;
        
        try {
            // Get config and validate
            const config = await this.getConfigById(configId);
            if (!config || !config.is_active) {
                throw new Error(`Invalid or inactive config: ${configId}`);
            }

            // Track webhook call
            await usageTrackingService.trackWebhookCall(
                config.user_id, 
                configId, 
                true, 
                { subject: emailData.subject }
            );

            // Check usage limits for email processing
            const quotaCheck = await usageTrackingService.checkQuotaLimit(
                config.user_id, 
                usageTrackingService.eventTypes.EMAIL_FILED
            );
            
            if (!quotaCheck.allowed) {
                await usageTrackingService.trackEmailProcessed(
                    config.user_id, 
                    config.instance_id, 
                    false, 
                    { reason: 'quota_exceeded', quota: quotaCheck }
                );
                throw new Error(`Usage quota exceeded: ${quotaCheck.reason}`);
            }

            // Create initial log entry
            logId = await this.createEmailLog(config, emailData);

            // Track email processing start
            await usageTrackingService.trackEmailProcessed(
                config.user_id, 
                config.instance_id, 
                true, 
                { subject: emailData.subject, log_id: logId }
            );

            // Extract control numbers from email
            const controlNumbers = await this.extractControlNumbers(emailData, config);
            
            if (controlNumbers.length === 0) {
                await this.updateEmailLog(logId, {
                    status: 'skipped',
                    error_message: 'No control numbers found in email'
                });
                
                await usageTrackingService.trackEmailProcessed(
                    config.user_id, 
                    config.instance_id, 
                    false, 
                    { reason: 'no_control_numbers', subject: emailData.subject }
                );
                
                return { success: false, message: 'No control numbers found' };
            }

            // Update log with found control numbers
            await this.updateEmailLog(logId, {
                control_numbers_found: controlNumbers
            });

            // Get IMS instance details
            const instance = await this.getInstanceById(config.instance_id);
            
            // Process each control number (usually just the first valid one)
            let fileResult = null;
            for (const controlNumber of controlNumbers) {
                try {
                    fileResult = await this.fileEmailToPolicy(instance, controlNumber, emailData, config, logId);
                    if (fileResult.success) {
                        break; // Success, stop trying other control numbers
                    }
                } catch (error) {
                    console.error(`Failed to file with control number ${controlNumber}:`, error);
                    continue; // Try next control number
                }
            }

            if (!fileResult || !fileResult.success) {
                await this.updateEmailLog(logId, {
                    status: 'error',
                    error_message: 'Failed to file email to any valid policy'
                });
                
                await usageTrackingService.trackEmailProcessed(
                    config.user_id, 
                    config.instance_id, 
                    false, 
                    { reason: 'filing_failed', control_numbers: controlNumbers }
                );
                
                return { success: false, message: 'Failed to file email' };
            }

            // Success
            await this.updateEmailLog(logId, {
                status: 'success',
                control_number_used: fileResult.controlNumber,
                policy_guid: fileResult.policyGuid,
                quote_guid: fileResult.quoteGuid,
                document_guid: fileResult.documentGuid,
                folder_id: fileResult.folderId
            });

            // Track successful email filing (billable event)
            await usageTrackingService.trackEmailFiled(
                config.user_id,
                config.instance_id,
                fileResult.controlNumber,
                fileResult.documentGuid,
                { 
                    subject: emailData.subject,
                    log_id: logId,
                    automated: true
                }
            );

            return {
                success: true,
                message: 'Email filed successfully',
                controlNumber: fileResult.controlNumber,
                documentGuid: fileResult.documentGuid
            };

        } catch (error) {
            console.error('Error processing incoming email:', error);
            
            // Track failed webhook call
            if (configId) {
                try {
                    const config = await this.getConfigById(configId);
                    if (config) {
                        await usageTrackingService.trackWebhookCall(
                            config.user_id, 
                            configId, 
                            false, 
                            { error: error.message }
                        );
                    }
                } catch (trackingError) {
                    console.error('Error tracking failed webhook:', trackingError);
                }
            }
            
            if (logId) {
                await this.updateEmailLog(logId, {
                    status: 'error',
                    error_message: error.message,
                    processing_attempts: 1
                });
            }

            throw error;
        }
    }

    async extractControlNumbers(emailData, config) {
        try {
            const patterns = config.control_number_patterns
                .split('\n')
                .filter(p => p.trim())
                .map(p => new RegExp(p.trim(), 'gi'));

            // Priority: look in subject line first (as per your workflow)
            const subjectText = emailData.subject || '';
            const bodyText = `${emailData.body_text || ''} ${emailData.body_html || ''}`;
            
            const foundNumbers = new Set();

            // First check subject line with the first pattern (start of subject only)
            const subjectStartPattern = /^(?:RE:\s*)?(\d{1,9})\b/i;
            const subjectMatch = subjectText.match(subjectStartPattern);
            if (subjectMatch) {
                foundNumbers.add(subjectMatch[1].trim());
                console.log(`Found control number in subject: ${subjectMatch[1]}`);
                return Array.from(foundNumbers); // Return immediately if found in subject
            }

            // If no match at start of subject, try other patterns on subject
            for (const pattern of patterns) {
                const matches = [...subjectText.matchAll(pattern)];
                if (matches.length > 0) {
                    matches.forEach(match => {
                        // Extract the captured group (the actual number) if it exists, otherwise use full match
                        const controlNumber = match[1] || match[0];
                        foundNumbers.add(controlNumber.trim());
                    });
                    if (foundNumbers.size > 0) break; // Stop after finding matches in subject line
                }
            }

            // If no matches in subject, check body as fallback
            if (foundNumbers.size === 0) {
                for (const pattern of patterns) {
                    const matches = [...bodyText.matchAll(pattern)];
                    if (matches.length > 0) {
                        matches.forEach(match => {
                            const controlNumber = match[1] || match[0];
                            foundNumbers.add(controlNumber.trim());
                        });
                    }
                }
            }

            console.log(`Extracted control numbers: ${Array.from(foundNumbers)}`);
            return Array.from(foundNumbers);
        } catch (error) {
            console.error('Error extracting control numbers:', error);
            return [];
        }
    }

    async fileEmailToPolicy(instance, controlNumber, emailData, config, logId) {
        try {
            console.log('=== EMAIL FILING STARTING - USING CONTROL-BASED APPROACH ===');
            console.log('Control number:', controlNumber);
            console.log('Method: fileEmailToPolicy - will use control-based workflow');
            
            // Log authentication configuration details
            console.log('=== EMAIL FILING AUTHENTICATION ===');
            console.log('Config ID:', config.config_id);
            console.log('Instance ID:', config.instance_id);
            console.log('User ID:', config.user_id);
            console.log('Instance details from database:');
            console.log('  - URL:', instance.url);
            console.log('  - Username:', instance.username);
            console.log('  - Password present:', !!instance.password);
            console.log('  - Password length:', instance.password ? instance.password.length : 'N/A');
            console.log('Authentication parameters being passed to authService:');
            console.log('  - URL parameter:', instance.url);
            console.log('  - Username parameter:', instance.username);
            console.log('  - Password parameter present:', !!instance.password);
            
            // Get IMS token
            const token = await authService.getToken(
                instance.url,
                instance.username,
                instance.password
            );

            console.log('=== TOKEN RECEIVED - STARTING CONTROL-BASED WORKFLOW ===');
            console.log('Token:', token);

            // Convert email to document format
            const documentData = await this.createDocumentFromEmail(emailData, controlNumber);
            console.log('=== DOCUMENT DATA CREATED ===');
            console.log('Document name:', documentData.name);

            console.log('=== STEP 1: VALIDATING CONTROL NUMBER ===');
            // First validate the control number and get the QuoteGuid
            const controlValidation = await this.validateControlNumber(instance, token, controlNumber);
            if (!controlValidation || !controlValidation.QuoteGuid) {
                throw new Error(`Invalid control number: ${controlNumber}. Control number not found in IMS.`);
            }

            console.log(`=== STEP 1 COMPLETE: Control validated for ${controlNumber}:`, controlValidation);

            console.log('=== STEP 2: FILING DOCUMENT WITH QUOTE GUID AS CONTROL GUID ===');
            // File document to IMS using the QuoteGuid as ControlGuid
            // Many IMS systems use QuoteGuid interchangeably with ControlGuid
            const documentGuid = await this.uploadDocumentToIMSByControl(
                instance,
                token,
                documentData,
                controlValidation.QuoteGuid,
                config
            );

            // Process attachments if enabled
            if (config.include_attachments && emailData.attachments) {
                await this.processEmailAttachments(
                    instance,
                    token,
                    emailData.attachments,
                    controlNumber,
                    logId
                );
            }

            return {
                success: true,
                controlNumber: controlNumber,
                documentGuid: documentGuid,
                quoteGuid: controlValidation.QuoteGuid,
                folderId: config.default_folder_id
            };

        } catch (error) {
            console.error(`Error filing email to policy ${controlNumber}:`, error);
            throw error;
        }
    }

    async getControlInformation(instance, token, controlNumber) {
        try {
            console.log(`=== GETTING CONTROL INFORMATION ===`);
            console.log(`Control number: ${controlNumber}`);
            console.log(`IMS URL: ${instance.url}`);
            
            // Try HTTP GET method first (simpler and less prone to XML parsing issues)
            console.log('=== TRYING HTTP GET METHOD ===');
            const getUrl = `${instance.url}/QuoteFunctions.asmx/GetControlInformation?controls=${encodeURIComponent(controlNumber)}`;
            console.log('GET URL:', getUrl);
            
            try {
                const getResponse = await fetch(getUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'text/xml'
                    }
                });

                console.log(`GetControlInformation GET response status: ${getResponse.status}`);

                if (getResponse.ok) {
                    const responseText = await getResponse.text();
                    console.log('GetControlInformation GET response:', responseText);
                    
                    // Look for GUID in the DataSet response
                    const guidMatches = responseText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
                    
                    if (guidMatches && guidMatches.length > 0) {
                        const controlGuid = guidMatches[0];
                        console.log(`Found ControlGuid via GET: ${controlGuid}`);
                        return {
                            ControlNumber: controlNumber,
                            ControlGuid: controlGuid,
                            RawResponse: responseText
                        };
                    }
                }
            } catch (getError) {
                console.log('GET method failed, trying SOAP:', getError.message);
            }

            // Fall back to SOAP method
            console.log('=== TRYING SOAP METHOD ===');
            const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <Token>${token}</Token>
            <Context>string</Context>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <GetControlInformation xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <controls>${controlNumber}</controls>
        </GetControlInformation>
    </soap:Body>
</soap:Envelope>`;

            console.log('SOAP request for GetControlInformation:');
            console.log(soapEnvelope);

            const response = await fetch(`${instance.url}/QuoteFunctions.asmx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IMSWebServices/QuoteFunctions/GetControlInformation'
                },
                body: soapEnvelope
            });

            console.log(`GetControlInformation SOAP response status: ${response.status}`);

            if (!response.ok) {
                const responseText = await response.text();
                console.error(`GetControlInformation SOAP failed: ${response.status} ${response.statusText}`, responseText);
                
                // If SOAP fails too, let's try ValidateControlNumber as alternative
                console.log('=== TRYING ValidateControlNumber as fallback ===');
                try {
                    const validateResult = await this.validateControlNumber(instance, token, controlNumber);
                    if (validateResult && validateResult.QuoteGuid) {
                        console.log('Using QuoteGuid as ControlGuid from ValidateControlNumber');
                        return {
                            ControlNumber: controlNumber,
                            ControlGuid: validateResult.QuoteGuid,
                            RawResponse: 'From ValidateControlNumber'
                        };
                    }
                } catch (validateError) {
                    console.log('ValidateControlNumber also failed:', validateError.message);
                }
                
                throw new Error(`GetControlInformation failed: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('GetControlInformation SOAP response:', responseText);
            
            // Parse the DataSet XML to extract control information
            const dataMatch = responseText.match(/<GetControlInformationResult[^>]*>(.*?)<\/GetControlInformationResult>/s);
            if (!dataMatch) {
                throw new Error('Could not extract control information from response');
            }

            console.log('Extracted control data:', dataMatch[1]);
            
            // Look for GUID in the response
            const guidMatches = dataMatch[1].match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
            
            if (!guidMatches || guidMatches.length === 0) {
                console.log('No control GUID found in response - control number may not exist');
                return null;
            }

            const controlGuid = guidMatches[0];
            console.log(`Found ControlGuid via SOAP: ${controlGuid}`);

            return {
                ControlNumber: controlNumber,
                ControlGuid: controlGuid,
                RawResponse: dataMatch[1]
            };

        } catch (error) {
            console.error('Error getting control information:', error);
            throw error;
        }
    }

    async validateControlNumber(instance, token, controlNumber) {
        try {
            // Use IMS ValidateControlNumber webservice
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
        <ValidateControlNumber xmlns="http://tempuri.org/IMSWebServices/QuoteFunctions">
            <controlNumber>${controlNumber}</controlNumber>
        </ValidateControlNumber>
    </soap:Body>
</soap:Envelope>`;

            const response = await fetch(`${instance.url}/QuoteFunctions.asmx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IMSWebServices/QuoteFunctions/ValidateControlNumber'
                },
                body: soapEnvelope
            });

            if (!response.ok) {
                throw new Error(`Control number validation failed: ${response.statusText}`);
            }

            const responseText = await response.text();
            
            // Extract GUID from SOAP response  
            const guidMatch = responseText.match(/<ValidateControlNumberResult>(.*?)<\/ValidateControlNumberResult>/);
            if (!guidMatch || guidMatch[1] === '00000000-0000-0000-0000-000000000000') {
                return null; // Invalid control number
            }

            return {
                IsValid: true,
                QuoteGuid: guidMatch[1],
                ControlNumber: controlNumber
            };

        } catch (error) {
            console.error('Error validating control number:', error);
            return null;
        }
    }

    async createDocumentFromEmail(emailData, controlNumber) {
        try {
            const timestamp = new Date().toISOString();
            const filename = `Email_${controlNumber}_${timestamp.substring(0, 10)}.html`;
            
            // Create HTML document from email
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Email - ${emailData.subject}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .email-header { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .email-body { line-height: 1.6; }
    </style>
</head>
<body>
    <div class="email-header">
        <h2>Email Communication</h2>
        <p><strong>Subject:</strong> ${emailData.subject}</p>
        <p><strong>From:</strong> ${emailData.from}</p>
        <p><strong>To:</strong> ${emailData.to}</p>
        <p><strong>Date:</strong> ${emailData.date}</p>
        <p><strong>Control Number:</strong> ${controlNumber}</p>
    </div>
    <div class="email-body">
        ${emailData.body_html || emailData.body_text.replace(/\n/g, '<br>')}
    </div>
</body>
</html>`;

            // Convert to base64 for IMS upload
            const documentData = Buffer.from(htmlContent, 'utf8').toString('base64');

            return {
                name: filename,
                data: documentData,
                description: `Email: ${emailData.subject}`,
                contentType: 'text/html'
            };

        } catch (error) {
            console.error('Error creating document from email:', error);
            throw error;
        }
    }

    async uploadDocumentToIMS(instance, token, documentData, policyInfo, config) {
        try {
            // Use IMS InsertTypedDocumentAssociatedToPolicy webservice
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
        <InsertTypedDocumentAssociatedToPolicy xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <userGuid>00000000-0000-0000-0000-000000000000</userGuid>
            <fileName>${documentData.name}</fileName>
            <fileData>${documentData.data}</fileData>
            <typeGuid>00000000-0000-0000-0000-000000000000</typeGuid>
            <description>${documentData.description}</description>
            <policyNumber>${policyInfo.ControlNumber}</policyNumber>
            <entityName>Email Communication</entityName>
        </InsertTypedDocumentAssociatedToPolicy>
    </soap:Body>
</soap:Envelope>`;

            const response = await fetch(`${instance.url}/DocumentFunctions.asmx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IMSWebServices/DocumentFunctions/InsertTypedDocumentAssociatedToPolicy'
                },
                body: soapEnvelope
            });

            if (!response.ok) {
                throw new Error(`Document upload failed: ${response.statusText}`);
            }

            const responseText = await response.text();
            
            // Extract document GUID from SOAP response
            const guidMatch = responseText.match(/<InsertTypedDocumentAssociatedToPolicyResult>(.*?)<\/InsertTypedDocumentAssociatedToPolicyResult>/);
            if (!guidMatch) {
                throw new Error('Could not extract document GUID from response');
            }

            return guidMatch[1]; // Return document GUID
        } catch (error) {
            console.error('Error uploading document to IMS:', error);
            throw error;
        }
    }

    async uploadDocumentToIMSByControl(instance, token, documentData, controlGuid, config) {
        try {
            console.log(`=== UPLOADING DOCUMENT TO IMS BY CONTROL ===`);
            console.log(`Control GUID: ${controlGuid}`);
            console.log(`Document name: ${documentData.name}`);
            console.log(`Document description: ${documentData.description}`);
            
            // Use IMS InsertAssociatedDocument webservice with ControlGuid
            const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <Token>${token}</Token>
            <Context>string</Context>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <InsertAssociatedDocument xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <file>
                <Name>${documentData.name}</Name>
                <Data>${documentData.data}</Data>
                <Description>${documentData.description}</Description>
                <MetaXml></MetaXml>
                <CopyForwardOnRenewal>false</CopyForwardOnRenewal>
            </file>
            <doc>
                <UserGuid>00000000-0000-0000-0000-000000000000</UserGuid>
                <TypeGuid>00000000-0000-0000-0000-000000000000</TypeGuid>
                <FolderID>${config.default_folder_id || 0}</FolderID>
                <CopyForwardOnRenewal>false</CopyForwardOnRenewal>
            </doc>
            <entity>
                <EntityGuid>00000000-0000-0000-0000-000000000000</EntityGuid>
                <ControlGuid>${controlGuid}</ControlGuid>
                <EntityName>Email Communication</EntityName>
                <EntityType>Quote</EntityType>
                <EntityAssociation>Quote</EntityAssociation>
            </entity>
        </InsertAssociatedDocument>
    </soap:Body>
</soap:Envelope>`;

            console.log(`Filing document to control ${controlGuid} at ${instance.url}/DocumentFunctions.asmx`);
            console.log(`Using authentication token: ${token}`);
            console.log(`SOAP envelope:`, soapEnvelope);
            
            const response = await fetch(`${instance.url}/DocumentFunctions.asmx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IMSWebServices/DocumentFunctions/InsertAssociatedDocument'
                },
                body: soapEnvelope
            });

            console.log(`InsertAssociatedDocument response status: ${response.status}`);

            if (!response.ok) {
                const responseText = await response.text();
                console.error(`Document upload failed: ${response.status} ${response.statusText}`, responseText);
                throw new Error(`Document upload failed: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('IMS InsertAssociatedDocument response:', responseText);
            
            // Extract document GUID from SOAP response
            const guidMatch = responseText.match(/<InsertAssociatedDocumentResult>(.*?)<\/InsertAssociatedDocumentResult>/);
            if (!guidMatch) {
                throw new Error('Could not extract document GUID from response: ' + responseText);
            }

            console.log(`Successfully filed document with GUID: ${guidMatch[1]}`);
            return guidMatch[1]; // Return document GUID
        } catch (error) {
            console.error('Error uploading document to IMS by control:', error);
            throw error;
        }
    }

    async uploadDocumentToIMSByPolicy(instance, token, documentData, controlNumber, config) {
        console.error('=== ERROR: OLD POLICY-BASED METHOD CALLED ===');
        console.error('This method should not be called anymore! We should be using uploadDocumentToIMSByControl');
        console.error('This indicates the deployment is using old code or there is a bug in the workflow');
        throw new Error('DEPRECATED: uploadDocumentToIMSByPolicy should not be called. Use control-based workflow instead.');
        
        try {
            // Use IMS InsertTypedDocumentAssociatedToPolicy webservice directly with control number
            const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <TokenHeader xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <Token>${token}</Token>
            <Context>string</Context>
        </TokenHeader>
    </soap:Header>
    <soap:Body>
        <InsertTypedDocumentAssociatedToPolicy xmlns="http://tempuri.org/IMSWebServices/DocumentFunctions">
            <userGuid>00000000-0000-0000-0000-000000000000</userGuid>
            <fileName>${documentData.name}</fileName>
            <fileData>${documentData.data}</fileData>
            <typeGuid>00000000-0000-0000-0000-000000000000</typeGuid>
            <description>${documentData.description}</description>
            <policyNumber>${controlNumber}</policyNumber>
            <entityName>Email Communication</entityName>
        </InsertTypedDocumentAssociatedToPolicy>
    </soap:Body>
</soap:Envelope>`;

            console.log(`Filing document to policy ${controlNumber} at ${instance.url}/DocumentFunctions.asmx`);
            console.log(`Using authentication token: ${token}`);
            console.log(`SOAP envelope:`, soapEnvelope);
            
            const response = await fetch(`${instance.url}/DocumentFunctions.asmx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IMSWebServices/DocumentFunctions/InsertTypedDocumentAssociatedToPolicy'
                },
                body: soapEnvelope
            });

            if (!response.ok) {
                const responseText = await response.text();
                console.error(`Document upload failed: ${response.status} ${response.statusText}`, responseText);
                throw new Error(`Document upload failed: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('IMS Document upload response:', responseText);
            
            // Extract document GUID from SOAP response
            const guidMatch = responseText.match(/<InsertTypedDocumentAssociatedToPolicyResult>(.*?)<\/InsertTypedDocumentAssociatedToPolicyResult>/);
            if (!guidMatch) {
                throw new Error('Could not extract document GUID from response: ' + responseText);
            }

            console.log(`Successfully filed document with GUID: ${guidMatch[1]}`);
            return guidMatch[1]; // Return document GUID
        } catch (error) {
            console.error('Error uploading document to IMS by policy:', error);
            throw error;
        }
    }

    async createEmailLog(config, emailData) {
        try {
            // Parse and validate date
            let emailDate;
            if (emailData.date && emailData.date !== 'Date' && emailData.date !== 'undefined') {
                try {
                    emailDate = new Date(emailData.date);
                    if (isNaN(emailDate.getTime())) {
                        emailDate = new Date(); // Use current date if invalid
                    }
                } catch {
                    emailDate = new Date(); // Use current date if parsing fails
                }
            } else {
                emailDate = new Date(); // Use current date if no date provided
            }

            const result = await pool.query(`
                INSERT INTO email_filing_logs 
                (config_id, instance_id, user_id, email_subject, email_from, 
                 email_to, email_date, email_message_id, email_body_text, 
                 email_body_html, attachments_count, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING log_id
            `, [
                config.config_id,
                config.instance_id,
                config.user_id,
                emailData.subject,
                emailData.from,
                emailData.to,
                emailDate.toISOString(),
                emailData.message_id,
                emailData.body_text,
                emailData.body_html,
                emailData.attachments ? emailData.attachments.length : 0,
                'pending'
            ]);

            return result.rows[0].log_id;
        } catch (error) {
            console.error('Error creating email log:', error);
            throw error;
        }
    }

    async updateEmailLog(logId, updates) {
        try {
            const setClause = Object.keys(updates)
                .map((key, index) => `${key} = $${index + 2}`)
                .join(', ');

            const values = [logId, ...Object.values(updates)];

            await pool.query(`
                UPDATE email_filing_logs 
                SET ${setClause}, processed_at = CURRENT_TIMESTAMP
                WHERE log_id = $1
            `, values);

        } catch (error) {
            console.error('Error updating email log:', error);
            throw error;
        }
    }

    async getConfigById(configId) {
        try {
            console.log('=== FETCHING EMAIL FILING CONFIG ===');
            console.log('Config ID requested:', configId);
            
            const result = await pool.query(`
                SELECT efc.*, ii.url, ii.username, ii.password
                FROM email_filing_configs efc
                JOIN ims_instances ii ON efc.instance_id = ii.instance_id
                WHERE efc.config_id = $1
            `, [configId]);

            const config = result.rows[0];
            if (config) {
                console.log('Config found:');
                console.log('  - Config ID:', config.config_id);
                console.log('  - Instance ID:', config.instance_id);
                console.log('  - User ID:', config.user_id);
                console.log('  - Config Name:', config.name);
                console.log('  - IMS URL from database:', config.url);
                console.log('  - IMS Username from database:', config.username);
                console.log('  - IMS Password present:', !!config.password);
                console.log('  - IMS Password length:', config.password ? config.password.length : 'N/A');
            } else {
                console.log('ERROR: No config found for ID:', configId);
            }

            return config;
        } catch (error) {
            console.error('Error getting config by ID:', error);
            throw error;
        }
    }

    async getInstanceById(instanceId) {
        try {
            const result = await pool.query(
                'SELECT * FROM ims_instances WHERE instance_id = $1',
                [instanceId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error getting instance by ID:', error);
            throw error;
        }
    }

    generateWebhookSecret() {
        return crypto.randomBytes(32).toString('hex');
    }

    async getEmailFilingLogs(userId, instanceId = null, limit = 100) {
        try {
            let query = `
                SELECT efl.*, efc.name as config_name, ii.name as instance_name
                FROM email_filing_logs efl
                LEFT JOIN email_filing_configs efc ON efl.config_id = efc.config_id
                LEFT JOIN ims_instances ii ON efl.instance_id = ii.instance_id
                WHERE efl.user_id = $1
            `;
            let params = [userId];

            if (instanceId) {
                query += ' AND efl.instance_id = $2';
                params.push(instanceId);
            }

            query += ` ORDER BY efl.processed_at DESC LIMIT $${params.length + 1}`;
            params.push(limit);

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error getting email filing logs:', error);
            throw error;
        }
    }
}

module.exports = new EmailFilingService();