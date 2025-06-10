const express = require('express');
const router = express.Router();
const customRoutesService = require('../services/customRoutesService');
const auth = require('../middleware/auth');

// ================ ROUTE MANAGEMENT ENDPOINTS ================

// Get all routes for an instance
router.get('/instance/:instanceId/routes', auth, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { includeInactive } = req.query;
        
        console.log(`🔍 [Custom Routes] Fetching routes for instance ${instanceId}`);
        
        const routes = await customRoutesService.getRoutes(
            parseInt(instanceId), 
            includeInactive === 'true'
        );
        
        console.log(`✅ [Custom Routes] Found ${routes.length} routes for instance ${instanceId}`);
        res.json(routes);
    } catch (error) {
        console.error('❌ [Custom Routes] Error fetching routes:', error);
        res.status(500).json({ error: 'Failed to fetch routes' });
    }
});

// Get a specific route with its fields
router.get('/instance/:instanceId/routes/:routeId', auth, async (req, res) => {
    try {
        const { instanceId, routeId } = req.params;
        
        const route = await customRoutesService.getRoute(
            parseInt(routeId), 
            parseInt(instanceId)
        );
        
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        
        res.json(route);
    } catch (error) {
        console.error('Error fetching route:', error);
        res.status(500).json({ error: 'Failed to fetch route' });
    }
});

// Create a new route
router.post('/instance/:instanceId/routes', auth, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const routeData = req.body;
        
        console.log(`🔧 [Custom Routes] Creating new route for instance ${instanceId}:`, routeData);
        
        // Validate required fields
        if (!routeData.name || !routeData.slug) {
            console.log('❌ [Custom Routes] Validation failed: missing name or slug');
            return res.status(400).json({ 
                error: 'Name and slug are required' 
            });
        }
        
        const route = await customRoutesService.createRoute(
            parseInt(instanceId), 
            routeData
        );
        
        console.log(`✅ [Custom Routes] Created route ${route.route_id} for instance ${instanceId}`);
        res.status(201).json(route);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            console.log('❌ [Custom Routes] Duplicate slug error');
            return res.status(409).json({ 
                error: 'A route with this slug already exists' 
            });
        }
        
        console.error('❌ [Custom Routes] Error creating route:', error);
        res.status(500).json({ error: 'Failed to create route' });
    }
});

// Update a route
router.put('/instance/:instanceId/routes/:routeId', auth, async (req, res) => {
    try {
        const { instanceId, routeId } = req.params;
        const updateData = req.body;
        
        const route = await customRoutesService.updateRoute(
            parseInt(routeId), 
            parseInt(instanceId), 
            updateData
        );
        
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        
        res.json(route);
    } catch (error) {
        console.error('Error updating route:', error);
        res.status(500).json({ error: 'Failed to update route' });
    }
});

// ================ FIELD MANAGEMENT ENDPOINTS ================

// Add a field to a route
router.post('/routes/:routeId/fields', auth, async (req, res) => {
    try {
        const { routeId } = req.params;
        const fieldData = req.body;
        
        // Validate required fields
        if (!fieldData.fieldName || !fieldData.fieldType || !fieldData.fieldLabel) {
            return res.status(400).json({ 
                error: 'Field name, type, and label are required' 
            });
        }
        
        const field = await customRoutesService.addField(
            parseInt(routeId), 
            fieldData
        );
        
        res.status(201).json(field);
    } catch (error) {
        console.error('Error adding field:', error);
        res.status(500).json({ error: 'Failed to add field' });
    }
});

// Update a field
router.put('/fields/:fieldId', auth, async (req, res) => {
    try {
        const { fieldId } = req.params;
        const updateData = req.body;
        
        const field = await customRoutesService.updateField(
            parseInt(fieldId), 
            updateData
        );
        
        if (!field) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        res.json(field);
    } catch (error) {
        console.error('Error updating field:', error);
        res.status(500).json({ error: 'Failed to update field' });
    }
});

// Delete a field
router.delete('/fields/:fieldId', auth, async (req, res) => {
    try {
        const { fieldId } = req.params;
        
        await customRoutesService.deleteField(parseInt(fieldId));
        
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting field:', error);
        res.status(500).json({ error: 'Failed to delete field' });
    }
});

// ================ PUBLIC SUBMISSION ENDPOINTS ================

// Get public route for form display (no auth required)
router.get('/public/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        // Get route by slug - this would need a new service method
        const route = await customRoutesService.getRouteBySlug(slug);
        
        if (!route || !route.is_active) {
            return res.status(404).json({ error: 'Route not found or inactive' });
        }
        
        // Return only necessary public information
        res.json({
            route_id: route.route_id,
            name: route.name,
            description: route.description,
            form_config: route.form_config,
            fields: route.fields
        });
    } catch (error) {
        console.error('Error fetching public route:', error);
        res.status(500).json({ error: 'Failed to fetch route' });
    }
});

// Submit a form (no auth required)
router.post('/public/:slug/submit', async (req, res) => {
    try {
        const { slug } = req.params;
        const submissionData = req.body;
        
        // Get route by slug
        const route = await customRoutesService.getRouteBySlug(slug);
        
        if (!route || !route.is_active) {
            return res.status(404).json({ error: 'Route not found or inactive' });
        }
        
        // Validate required fields based on route configuration
        const validationResult = await validateSubmission(route, submissionData);
        if (!validationResult.valid) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: validationResult.errors 
            });
        }
        
        // Create submission
        const submission = await customRoutesService.createSubmission(
            route.route_id, 
            submissionData
        );
        
        // Start processing asynchronously if configured
        if (route.workflow_config.autoProcess) {
            // Get IMS credentials from instance
            const imsCredentials = await getIMSCredentials(route.instance_id);
            
            // Process in background
            customRoutesService.processSubmission(submission.submission_id, imsCredentials)
                .catch(error => {
                    console.error('Background processing failed:', error);
                });
        }
        
        res.status(201).json({
            success: true,
            submissionId: submission.submission_uuid,
            message: 'Your submission has been received and is being processed.'
        });
    } catch (error) {
        console.error('Error submitting form:', error);
        res.status(500).json({ error: 'Failed to submit form' });
    }
});

// Check submission status (public, by UUID)
router.get('/public/submission/:uuid/status', async (req, res) => {
    try {
        const { uuid } = req.params;
        
        const submission = await customRoutesService.getSubmissionByUUID(uuid);
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        // Return sanitized status information
        res.json({
            status: submission.status,
            workflow_step: submission.workflow_step,
            submitted_at: submission.submitted_at,
            processed_at: submission.processed_at,
            ims_policy_number: submission.ims_policy_number
        });
    } catch (error) {
        console.error('Error checking submission status:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// ================ ADMIN SUBMISSION MANAGEMENT ================

// Get submissions for a route
router.get('/instance/:instanceId/routes/:routeId/submissions', auth, async (req, res) => {
    try {
        const { routeId } = req.params;
        const { status } = req.query;
        
        const submissions = await customRoutesService.getSubmissions(
            parseInt(routeId), 
            status
        );
        
        res.json(submissions);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Get specific submission details
router.get('/submissions/:submissionId', auth, async (req, res) => {
    try {
        const { submissionId } = req.params;
        
        const submission = await customRoutesService.getSubmission(
            parseInt(submissionId)
        );
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        // Get workflow log
        const workflowLog = await customRoutesService.getWorkflowLog(
            parseInt(submissionId)
        );
        
        res.json({
            ...submission,
            workflow_log: workflowLog
        });
    } catch (error) {
        console.error('Error fetching submission:', error);
        res.status(500).json({ error: 'Failed to fetch submission' });
    }
});

// Manually process a submission
router.post('/submissions/:submissionId/process', auth, async (req, res) => {
    try {
        const { submissionId } = req.params;
        
        const submission = await customRoutesService.getSubmission(
            parseInt(submissionId)
        );
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        // Get IMS credentials
        const imsCredentials = await getIMSCredentials(submission.instance_id);
        
        // Process submission
        const result = await customRoutesService.processSubmission(
            parseInt(submissionId), 
            imsCredentials
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error processing submission:', error);
        res.status(500).json({ error: 'Failed to process submission' });
    }
});

// ================ IMS CONFIGURATION ENDPOINTS ================

// Get IMS configuration data for form building
router.get('/instance/:instanceId/ims-config/:configType', auth, async (req, res) => {
    try {
        const { instanceId, configType } = req.params;
        
        // Get IMS credentials
        const imsCredentials = await getIMSCredentials(parseInt(instanceId));
        
        // Get configuration data (cached)
        const configData = await customRoutesService.getIMSConfiguration(
            parseInt(instanceId), 
            configType, 
            imsCredentials
        );
        
        res.json(configData);
    } catch (error) {
        console.error('Error fetching IMS config:', error);
        res.status(500).json({ error: 'Failed to fetch IMS configuration' });
    }
});

// ================ HELPER FUNCTIONS ================

async function validateSubmission(route, submissionData) {
    const errors = [];
    
    // Validate required fields
    for (const field of route.fields) {
        if (field.is_required && !submissionData.formData[field.field_name]) {
            errors.push(`${field.field_label} is required`);
        }
        
        // Add more validation logic based on field type and configuration
        if (field.field_config.validation) {
            const fieldValue = submissionData.formData[field.field_name];
            const validation = field.field_config.validation;
            
            // Email validation
            if (validation.type === 'email' && fieldValue) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(fieldValue)) {
                    errors.push(`${field.field_label} must be a valid email address`);
                }
            }
            
            // Phone validation
            if (validation.type === 'phone' && fieldValue) {
                const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
                if (!phoneRegex.test(fieldValue)) {
                    errors.push(`${field.field_label} must be a valid phone number`);
                }
            }
            
            // Length validation
            if (validation.maxLength && fieldValue && fieldValue.length > validation.maxLength) {
                errors.push(`${field.field_label} must not exceed ${validation.maxLength} characters`);
            }
            
            if (validation.minLength && fieldValue && fieldValue.length < validation.minLength) {
                errors.push(`${field.field_label} must be at least ${validation.minLength} characters`);
            }
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

async function getIMSCredentials(instanceId) {
    // This would fetch the IMS credentials from the ims_instances table
    // For security, credentials should be encrypted in storage
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT url, username, password FROM ims_instances WHERE instance_id = $1',
            [instanceId]
        );
        
        if (result.rows.length === 0) {
            throw new Error('IMS instance not found');
        }
        
        return result.rows[0];
    } finally {
        client.release();
    }
}

module.exports = router;