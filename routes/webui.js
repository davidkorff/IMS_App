const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../config/db');
const authService = require('../services/authService');
const dataAccess = require('../services/dataAccess');
const documentService = require('../services/documentService');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');

// Import submission router
console.log('Loading submission router in webui.js');
const submissionRouter = require('./webui/submission');
router.use('/submission', submissionRouter);

router.get('/:id/webui', auth, async (req, res) => {
    try {
        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [req.params.id, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get IMS token using authService
        const imsToken = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        // Send JSON response instead of rendering
        res.json({ 
            instance: instance.rows[0],
            imsToken: imsToken
        });

    } catch (err) {
        console.error('Error accessing web UI:', err);
        res.status(500).json({ message: 'Error accessing IMS Web Interface' });
    }
});

// API endpoint for getting instance data with IMS token
router.get('/api/instances/:id/webui', auth, async (req, res) => {
    try {
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [req.params.id, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get IMS token
        const imsToken = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        res.json({
            ...instance.rows[0],
            imsToken
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/search', auth, async (req, res) => {
    try {
        const { instanceId, controlNo, customerName } = req.body;
        
        console.log('Received parameters:', { controlNo, customerName });

        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Build parameters object - only include parameters that were sent
        const parameters = {};
        if (controlNo !== undefined) {
            parameters.controlno = controlNo;
        }
        if (customerName !== undefined) {
            parameters.customername = customerName;
        }

        console.log('Executing procedure with parameters:', parameters);

        // Call the stored procedure using dataAccess service
        const results = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_Submission_Search_WS',
            parameters
        });

        console.log('Result count:', results.Table?.length || 0);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ message: 'Error searching policies' });
    }
});

// Add these new routes to handle policy details and documents

router.post('/policy-details', auth, async (req, res) => {
    try {
        const { instanceId, controlNo } = req.body;

        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get policy details using DataAccess
        const results = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_Policy_Details_WS',
            parameters: {
                controlno: controlNo
            }
        });

        // Return the first policy found
        const policy = results?.Table?.[0] || null;
        if (!policy) {
            return res.status(404).json({ message: 'Policy not found' });
        }

        res.json(policy);
    } catch (err) {
        console.error('Policy details error:', err);
        res.status(500).json({ message: 'Error getting policy details' });
    }
});

router.post('/policy-documents', auth, async (req, res) => {
    try {
        const { instanceId, quoteGuid } = req.body;

        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get document list using DocumentFunctions
        const results = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_Policy_Documents_WS',
            parameters: {
                quoteguid: quoteGuid
            }
        });

        res.json(results?.Table || []);
    } catch (err) {
        console.error('Policy documents error:', err);
        res.status(500).json({ message: 'Error getting policy documents' });
    }
});

router.post('/rating-sheet', auth, async (req, res) => {
    try {
        const { instanceId, quoteGuid } = req.body;

        // Get instance details from database
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get token
        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        // Get rating sheet using new document service
        const result = await documentService.getRatingSheet(
            instance.rows[0].url,
            token,
            quoteGuid
        );

        res.json(result);
    } catch (err) {
        console.error('Error getting rating sheet:', err);
        res.status(500).json({ message: 'Error getting rating sheet' });
    }
});

router.post('/view-document', auth, async (req, res) => {
    try {
        const { instanceId, documentGuid } = req.body;

        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Get document using DocumentFunctions
        const results = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_Policy_ViewDocument_WS',
            parameters: {
                documentguid: documentGuid
            }
        });

        // Assuming the document is returned as base64
        const documentData = results?.Table?.[0]?.DocumentData;
        if (!documentData) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Convert base64 to buffer and send as binary
        const buffer = Buffer.from(documentData, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.send(buffer);
    } catch (err) {
        console.error('View document error:', err);
        res.status(500).json({ message: 'Error viewing document' });
    }
});

router.post('/ims-login', auth, async (req, res) => {
    try {
        const { instanceId, quoteId } = req.body;

        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        console.log('Using instance:', {
            url: instance.rows[0].url,
            username: instance.rows[0].username
        });

        // Use QuoteID parameter
        const results = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'VM_CRMPortal_QuoteDetails_WS',
            parameters: {
                QuoteId: quoteId
            }
        });

        console.log('Quote details response:', results);
        res.json(results);
    } catch (err) {
        console.error('Quote details error:', err);
        res.status(500).json({ message: 'Error getting quote details' });
    }
});

// Document Creation Routes
router.post('/documents/createBinder', auth, async (req, res) => {
    try {
        const { instanceId, quoteGuid } = req.body;
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        const result = await documentService.createBinderDocument(
            instance.rows[0].url,
            token,
            { quoteGuid }
        );

        res.json(result);
    } catch (err) {
        console.error('Error creating binder:', err);
        res.status(500).json({ message: 'Error creating binder document' });
    }
});

router.post('/documents/createPolicy', auth, async (req, res) => {
    try {
        const { instanceId, quoteGuid } = req.body;
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        const result = await documentService.createPolicyDocument(
            instance.rows[0].url,
            token,
            { quoteGuid }
        );

        res.json(result);
    } catch (err) {
        console.error('Error creating policy:', err);
        res.status(500).json({ message: 'Error creating policy document' });
    }
});

router.post('/documents/fromFolder', auth, async (req, res) => {
    try {
        const { instanceId, folderId } = req.body;
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        const result = await documentService.getDocumentFromFolder(
            instance.rows[0].url,
            token,
            { folderId }
        );

        res.json(result);
    } catch (err) {
        console.error('Error getting document from folder:', err);
        res.status(500).json({ message: 'Error getting document from folder' });
    }
});

router.post('/documents/fromStore', auth, async (req, res) => {
    try {
        const { instanceId, documentGuid } = req.body;
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        const result = await documentService.getDocumentFromStore(
            instance.rows[0].url,
            token,
            { documentGuid }
        );

        res.json(result);
    } catch (err) {
        console.error('Error getting document from store:', err);
        res.status(500).json({ message: 'Error getting document from store' });
    }
});

router.post('/documents/insertAssociated', auth, async (req, res) => {
    try {
        const { instanceId, quoteGuid, documentGuid } = req.body;
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        const result = await documentService.insertAssociatedDocument(
            instance.rows[0].url,
            token,
            { quoteGuid, documentGuid }
        );

        res.json(result);
    } catch (err) {
        console.error('Error inserting associated document:', err);
        res.status(500).json({ message: 'Error inserting associated document' });
    }
});

router.post('/documents/applyForms', auth, async (req, res) => {
    try {
        const { instanceId, quoteGuid } = req.body;
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        const result = await documentService.applyPolicyForms(
            instance.rows[0].url,
            token,
            { quoteGuid }
        );

        res.json(result);
    } catch (err) {
        console.error('Error applying policy forms:', err);
        res.status(500).json({ message: 'Error applying policy forms' });
    }
});

router.get('/documents/verify-folder/:folderId', auth, async (req, res) => {
    try {
        const { instanceId } = req.query;
        const { folderId } = req.params;

        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        const token = await authService.getToken(
            instance.rows[0].url,
            instance.rows[0].username,
            instance.rows[0].password
        );

        const exists = await documentService.verifyFolder(
            instance.rows[0].url,
            token,
            folderId
        );

        res.json({ exists });
    } catch (err) {
        console.error('Error verifying folder:', err);
        res.status(500).json({ message: 'Error verifying folder' });
    }
});

// Add this route to handle the forms page
router.get('/instance/:instanceId/forms', auth, async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        // Verify instance access
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).redirect('/dashboard');
        }

        // Send the forms.html page
        res.sendFile(path.join(__dirname, '../public/forms.html'));
    } catch (err) {
        console.error('Error accessing forms page:', err);
        res.status(500).redirect('/dashboard');
    }
});

// Add this route to handle the lines data
router.get('/data/lines', auth, async (req, res) => {
    try {
        const { instanceId } = req.query;
        console.log('Lines request received for instanceId:', instanceId);
        
        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        console.log('Instance query result:', instance.rows);

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Use the dataAccess service to call the procedure
        console.log('Calling dataAccess with procedure: DK_LineSearch');
        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_LineSearch',
            parameters: {}
        });
        console.log('DataAccess result:', result);

        res.json(result);
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ message: 'Failed to get lines', error: error.message });
    }
});

// Update this route to handle the forms data
router.get('/forms/all', auth, async (req, res) => {
    try {
        const { instanceId, companyLineId } = req.query;
        
        console.log('API Request:', {
            instanceId,
            companyLineId,
            headers: req.headers
        });

        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        console.log('Instance found:', instance.rows[0]);

        // Call DataAccess service with the new procedure
        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_GetCompanyLineForms_WS',
            parameters: {
                LineID: parseInt(companyLineId)
            }
        });

        console.log('DataAccess Result:', result);
        res.json(result);
    } catch (error) {
        console.error('Detailed Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            message: 'Failed to get forms',
            error: error.message,
            stack: error.stack
        });
    }
});

// Add this route to handle the forms page
router.get('/instance/:instanceId/forms/all', auth, async (req, res) => {
    try {
        const { instanceId } = req.params;
        
        // Verify instance access
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).redirect('/dashboard');
        }

        // Send the forms-all.html page
        res.sendFile(path.join(__dirname, '../public/forms-all.html'));
    } catch (err) {
        console.error('Error accessing forms page:', err);
        res.status(500).redirect('/dashboard');
    }
});

// Add this POST endpoint for form content
router.post('/forms/all', auth, async (req, res) => {
    try {
        const { instanceId, formId } = req.body;
        
        // Get instance details
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Call DataAccess service
        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_GetFormContent',
            parameters: {
                FormID: formId
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error getting form content:', error);
        res.status(500).json({ message: 'Failed to get form content' });
    }
});

// Add these new routes for company/line/state form filtering

router.get('/forms/companies', auth, async (req, res) => {
    try {
        const { instanceId } = req.query;
        console.log('Getting companies for instance:', instanceId);
        
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            console.error('Instance not found:', instanceId);
            return res.status(404).json({ message: 'Instance not found' });
        }

        console.log('Calling DK_GetCompanies_WS with instance:', {
            url: instance.rows[0].url,
            username: instance.rows[0].username
        });

        // Call DataAccess service to get companies - no parameters needed
        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_GetCompanies_WS',
            parameters: {}  // Empty parameters object
        });

        console.log('DK_GetCompanies_WS result:', result);
        res.json(result.Table || []);
    } catch (error) {
        console.error('Error getting companies:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ message: 'Failed to get companies', error: error.message });
    }
});

router.get('/forms/lines', auth, async (req, res) => {
    try {
        const { instanceId } = req.query;
        console.log('Getting lines for instance:', instanceId);
        
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            console.error('Instance not found:', instanceId);
            return res.status(404).json({ message: 'Instance not found' });
        }

        console.log('Calling DK_GetLines_WS');

        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_GetLines_WS',
            parameters: {}  // No parameters needed
        });

        console.log('DK_GetLines_WS result:', result);
        res.json(result.Table || []);
    } catch (error) {
        console.error('Error getting lines:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ message: 'Failed to get lines', error: error.message });
    }
});

router.get('/forms/states', auth, async (req, res) => {
    try {
        const { instanceId } = req.query;
        console.log('Getting states for instance:', instanceId);
        
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            console.error('Instance not found:', instanceId);
            return res.status(404).json({ message: 'Instance not found' });
        }

        console.log('Calling DK_GetStates_WS');

        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_GetStates_WS',
            parameters: {}  // No parameters needed
        });

        console.log('DK_GetStates_WS result:', result);
        res.json(result.Table || []);
    } catch (error) {
        console.error('Error getting states:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ message: 'Failed to get states', error: error.message });
    }
});

router.get('/forms/filtered', auth, async (req, res) => {
    try {
        const { instanceId, companyLocationGuid, lineGuid, stateId } = req.query;
        
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );

        if (instance.rows.length === 0) {
            return res.status(404).json({ message: 'Instance not found' });
        }

        // Build parameters object - only include parameters that have actual values
        const parameters = {};
        
        if (lineGuid && lineGuid !== 'undefined' && lineGuid !== '') {
            parameters.LineGUID = lineGuid;
        }
        
        if (companyLocationGuid && companyLocationGuid !== 'undefined' && companyLocationGuid !== '') {
            parameters.CompanyLocationGUID = companyLocationGuid;
        }
        
        if (stateId && stateId !== 'undefined' && stateId !== '') {
            parameters.StateID = stateId;  // Keep as string, don't convert to number
        }

        console.log('Final parameters for stored procedure:', parameters);

        const result = await dataAccess.executeProc({
            url: instance.rows[0].url,
            username: instance.rows[0].username,
            password: instance.rows[0].password,
            procedure: 'DK_GetCompanyStateLines_WS',
            parameters: parameters
        });

        res.json(result);
    } catch (error) {
        console.error('Error getting filtered results:', error);
        res.status(500).json({ message: 'Failed to get filtered results', error: error.message });
    }
});

module.exports = router; 