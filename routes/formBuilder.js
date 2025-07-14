const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Get all form schemas for an instance
router.get('/schemas', auth, async (req, res) => {
    try {
        const instanceId = req.headers['x-instance-id'] || req.user.instance_id;
        
        const result = await pool.query(`
            SELECT 
                fs.*,
                lob.line_name,
                u.username as created_by_name
            FROM form_schemas fs
            LEFT JOIN portal_lines_of_business lob ON fs.lob_id = lob.lob_id
            LEFT JOIN users u ON fs.created_by = u.user_id
            WHERE fs.instance_id = $1
            ORDER BY fs.updated_at DESC
        `, [instanceId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching form schemas:', error);
        res.status(500).json({ error: 'Failed to fetch form schemas' });
    }
});

// Get a specific form schema
router.get('/schemas/:formId', auth, async (req, res) => {
    console.log('📥 GET /api/forms/schemas/:formId called');
    console.log('  - formId:', req.params.formId);
    console.log('  - headers:', req.headers);
    console.log('  - user:', req.user);
    
    try {
        const { formId } = req.params;
        const instanceId = req.headers['x-instance-id'] || req.user.instance_id;
        
        console.log('  - Using instanceId:', instanceId);
        
        // Get form schema regardless of LOB ID (it might be null)
        const result = await pool.query(`
            SELECT * FROM form_schemas 
            WHERE form_id = $1 AND instance_id = $2
        `, [formId, instanceId]);
        
        console.log('  - Query result rows:', result.rows.length);
        
        if (result.rows.length === 0) {
            console.log('  - ❌ Form schema not found');
            return res.status(404).json({ error: 'Form schema not found' });
        }
        
        console.log('  - ✅ Form schema found:', {
            form_id: result.rows[0].form_id,
            title: result.rows[0].title,
            has_form_schema: !!result.rows[0].form_schema
        });
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching form schema:', error);
        res.status(500).json({ error: 'Failed to fetch form schema' });
    }
});

// Create or update form schema
router.post('/schemas', auth, async (req, res) => {
    try {
        // Get instance ID from header or user context
        let instanceId = req.headers['x-instance-id'] || req.user.instance_id || req.user.instanceId;
        
        // Parse instance ID if it's a string number
        if (instanceId && typeof instanceId === 'string' && /^\d+$/.test(instanceId)) {
            instanceId = parseInt(instanceId, 10);
        }
        
        // Validate instance ID
        if (!instanceId || isNaN(instanceId)) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        const userId = req.user.user_id || req.user.userId;
        const { form_id, lob_id, title, description, form_schema, is_template } = req.body;
        
        if (form_id) {
            // Update existing schema
            const result = await pool.query(`
                UPDATE form_schemas 
                SET 
                    title = $1,
                    description = $2,
                    form_schema = $3,
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = $4
                WHERE form_id = $5 AND instance_id = $6
                RETURNING *
            `, [title, description, form_schema, userId, form_id, instanceId]);
            
            res.json(result.rows[0]);
        } else {
            // Create new schema
            const result = await pool.query(`
                INSERT INTO form_schemas 
                (instance_id, lob_id, title, description, form_schema, is_template, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
                RETURNING *
            `, [instanceId, lob_id, title, description, form_schema, is_template || false, userId]);
            
            res.json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error saving form schema:', error);
        res.status(500).json({ error: 'Failed to save form schema' });
    }
});

// Delete form schema
router.delete('/schemas/:formId', auth, async (req, res) => {
    try {
        const { formId } = req.params;
        const instanceId = req.headers['x-instance-id'] || req.user.instance_id;
        
        await pool.query(`
            UPDATE form_schemas 
            SET is_active = false 
            WHERE form_id = $1 AND instance_id = $2
        `, [formId, instanceId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting form schema:', error);
        res.status(500).json({ error: 'Failed to delete form schema' });
    }
});

// Get form templates
router.get('/templates', auth, async (req, res) => {
    try {
        const instanceId = req.headers['x-instance-id'] || req.user.instance_id;
        
        const result = await pool.query(`
            SELECT * FROM form_templates 
            WHERE instance_id = $1 OR is_public = true
            ORDER BY category, name
        `, [instanceId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching form templates:', error);
        res.status(500).json({ error: 'Failed to fetch form templates' });
    }
});

// Save form submission data (draft or final)
router.post('/submissions', auth, async (req, res) => {
    try {
        const { form_id, producer_submission_id, form_data, form_state, is_draft } = req.body;
        const producerId = req.producer?.producerId || req.user.user_id;
        
        // Check if submission already exists
        const existing = await pool.query(`
            SELECT submission_id FROM form_submissions
            WHERE form_id = $1 AND producer_submission_id = $2
        `, [form_id, producer_submission_id]);
        
        if (existing.rows.length > 0) {
            // Update existing submission
            const result = await pool.query(`
                UPDATE form_submissions
                SET 
                    form_data = $1,
                    form_state = $2,
                    is_draft = $3,
                    completed_at = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE submission_id = $5
                RETURNING *
            `, [form_data, form_state, is_draft, is_draft ? null : new Date(), existing.rows[0].submission_id]);
            
            res.json(result.rows[0]);
        } else {
            // Create new submission
            const result = await pool.query(`
                INSERT INTO form_submissions
                (form_id, producer_id, producer_submission_id, form_data, form_state, is_draft, completed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [form_id, producerId, producer_submission_id, form_data, form_state, is_draft, is_draft ? null : new Date()]);
            
            res.json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error saving form submission:', error);
        res.status(500).json({ error: 'Failed to save form submission' });
    }
});

// Get form submission data
router.get('/submissions/:producerSubmissionId', auth, async (req, res) => {
    try {
        const { producerSubmissionId } = req.params;
        
        const result = await pool.query(`
            SELECT fs.*, f.form_schema
            FROM form_submissions fs
            JOIN form_schemas f ON fs.form_id = f.form_id
            WHERE fs.producer_submission_id = $1
        `, [producerSubmissionId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Form submission not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching form submission:', error);
        res.status(500).json({ error: 'Failed to fetch form submission' });
    }
});

// Update form schema LOB ID
router.patch('/schemas/:formId/lob', auth, async (req, res) => {
    try {
        const { formId } = req.params;
        const { lob_id } = req.body;
        
        const result = await pool.query(`
            UPDATE form_schemas 
            SET lob_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE form_id = $2
            RETURNING *
        `, [lob_id, formId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Form schema not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating form LOB ID:', error);
        res.status(500).json({ error: 'Failed to update form schema' });
    }
});

// Link form schema to LOB
router.post('/link-to-lob', auth, async (req, res) => {
    try {
        const { lob_id, form_schema_id } = req.body;
        const instanceId = req.headers['x-instance-id'] || req.user.instance_id;
        
        await pool.query(`
            UPDATE portal_lines_of_business
            SET form_schema_id = $1
            WHERE lob_id = $2 AND instance_id = $3
        `, [form_schema_id, lob_id, instanceId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error linking form to LOB:', error);
        res.status(500).json({ error: 'Failed to link form to LOB' });
    }
});

module.exports = router;