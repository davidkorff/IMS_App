const express = require('express');
const router = express.Router();
const producerAuthService = require('../services/producerAuthService');
// Use test middleware if running on port 5001
const isTestMode = process.env.PORT === '5001' || !process.env.PORT;
const { authenticateProducer, getInstanceFromSubdomain } = isTestMode 
    ? require('../middleware/producerAuthTest')
    : require('../middleware/producerAuth');
const pool = require('../config/db');

// ==================== PUBLIC ROUTES (No Auth Required) ====================

// Get portal configuration (for branding)
router.get('/portal/config', async (req, res) => {
    try {
        let instanceId;
        
        // First check if we have portal instance from subdomain middleware
        if (req.portalInstance && req.portalInstance.instanceId) {
            instanceId = req.portalInstance.instanceId;
        } else if (req.query.instanceId) {
            // Fall back to query param if provided
            instanceId = req.query.instanceId;
        } else {
            // Try to get from subdomain
            const host = req.hostname || req.headers.host;
            const subdomain = host.split('.')[0];
            
            if (subdomain && subdomain !== 'localhost' && subdomain !== 'www' && subdomain !== '42ims') {
                try {
                    const result = await pool.query(`
                        SELECT instance_id FROM ims_instances 
                        WHERE LOWER(custom_domain) = LOWER($1)
                        AND is_custom_domain_approved = true
                    `, [subdomain]);
                    
                    if (result.rows.length > 0) {
                        instanceId = result.rows[0].instance_id;
                    }
                } catch (error) {
                    console.error('Subdomain lookup error:', error);
                }
            }
        }
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        const result = await pool.query(`
            SELECT 
                ppc.portal_name,
                ppc.logo_url,
                ppc.primary_color,
                ppc.secondary_color,
                ppc.custom_css,
                ppc.custom_js,
                ppc.welcome_message,
                ppc.terms_of_service,
                i.name as instance_name,
                i.instance_id
            FROM producer_portal_config ppc
            JOIN ims_instances i ON ppc.instance_id = i.instance_id
            WHERE ppc.instance_id = $1 AND ppc.is_active = true
        `, [instanceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Portal configuration not found' });
        }

        res.json({
            config: result.rows[0],
            instance: {
                id: result.rows[0].instance_id,
                name: result.rows[0].instance_name
            }
        });
    } catch (error) {
        console.error('Error fetching portal config:', error);
        res.status(500).json({ error: 'Failed to fetch portal configuration' });
    }
});

// Producer registration
router.post('/auth/register', async (req, res) => {
    try {
        // Determine instance ID
        let instanceId;
        
        // First check if we have portal instance from subdomain middleware
        if (req.portalInstance && req.portalInstance.instanceId) {
            instanceId = req.portalInstance.instanceId;
        } else if (req.body.instanceId) {
            // Fall back to request body if provided
            instanceId = req.body.instanceId;
        } else {
            // Try to get from subdomain if not set by middleware
            const host = req.hostname || req.headers.host;
            const subdomain = host.split('.')[0];
            
            if (subdomain && subdomain !== 'localhost' && subdomain !== 'www' && subdomain !== '42ims') {
                try {
                    const result = await pool.query(`
                        SELECT instance_id FROM ims_instances 
                        WHERE LOWER(custom_domain) = LOWER($1)
                        AND is_custom_domain_approved = true
                    `, [subdomain]);
                    
                    if (result.rows.length > 0) {
                        instanceId = result.rows[0].instance_id;
                    }
                } catch (error) {
                    console.error('Subdomain lookup error:', error);
                }
            }
        }
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required. Please use the registration link provided by your administrator.' });
        }
        
        const producerData = {
            email: req.body.email,
            password: req.body.password,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            agencyName: req.body.agencyName,
            phone: req.body.phone,
            address1: req.body.address1,
            address2: req.body.address2,
            city: req.body.city,
            state: req.body.state,
            zip: req.body.zip
        };

        // Validate required fields
        const requiredFields = ['email', 'password', 'firstName', 'lastName', 'agencyName'];
        for (const field of requiredFields) {
            if (!producerData[field]) {
                return res.status(400).json({ error: `${field} is required` });
            }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(producerData.email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength
        if (producerData.password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        const result = await producerAuthService.register(instanceId, producerData);

        // TODO: Send verification email
        console.log(`Verification token for ${result.email}: ${result.verificationToken}`);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            producerId: result.producerId
        });

    } catch (error) {
        console.error('Registration error:', error);
        if (error.message === 'Email already registered for this portal') {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Email verification
router.post('/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Verification token required' });
        }

        const result = await producerAuthService.verifyEmail(token);

        res.json({
            success: true,
            message: 'Email verified successfully. Your account is pending approval.',
            instanceId: result.instance_id
        });

    } catch (error) {
        console.error('Email verification error:', error);
        if (error.message === 'Invalid or expired verification token') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Producer login
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password, instanceId } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Determine instance ID
        let resolvedInstanceId = instanceId;
        
        // First check if we have portal instance from subdomain middleware
        if (!resolvedInstanceId && req.portalInstance && req.portalInstance.instanceId) {
            resolvedInstanceId = req.portalInstance.instanceId;
        }
        
        if (!resolvedInstanceId) {
            // Try to get from subdomain if not provided
            const host = req.hostname || req.headers.host;
            const subdomain = host.split('.')[0];
            
            if (subdomain && subdomain !== 'localhost' && subdomain !== 'www' && subdomain !== '42ims') {
                try {
                    const result = await pool.query(`
                        SELECT instance_id FROM ims_instances 
                        WHERE LOWER(custom_domain) = LOWER($1)
                        AND is_custom_domain_approved = true
                    `, [subdomain]);
                    
                    if (result.rows.length > 0) {
                        resolvedInstanceId = result.rows[0].instance_id;
                    }
                } catch (error) {
                    console.error('Subdomain lookup error:', error);
                }
            }
        }
        
        if (!resolvedInstanceId) {
            return res.status(400).json({ error: 'Could not determine instance. Please use the login link provided by your administrator.' });
        }

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const result = await producerAuthService.login(
            resolvedInstanceId, 
            email, 
            password, 
            ipAddress, 
            userAgent
        );

        res.json({
            success: true,
            token: result.token,
            sessionToken: result.sessionToken,
            producer: result.producer
        });

    } catch (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid credentials') || 
            error.message.includes('verify your email') ||
            error.message.includes('Account is')) {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: 'Login failed' });
    }
});

// Request password reset
router.post('/auth/forgot-password', getInstanceFromSubdomain, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const result = await producerAuthService.requestPasswordReset(req.instanceId, email);

        // Always return success to avoid revealing if email exists
        res.json({
            success: true,
            message: 'If the email exists in our system, you will receive a password reset link.'
        });

        // TODO: Send password reset email if email exists
        if (result.resetToken) {
            console.log(`Password reset token for ${result.email}: ${result.resetToken}`);
        }

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Reset password
router.post('/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        await producerAuthService.resetPassword(token, password);

        res.json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        if (error.message === 'Invalid or expired reset token') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Password reset failed' });
    }
});

// ==================== AUTHENTICATED ROUTES ====================

// Logout
router.post('/auth/logout', authenticateProducer, async (req, res) => {
    try {
        const sessionToken = req.headers['x-session-token'];
        if (sessionToken) {
            await producerAuthService.logout(sessionToken);
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Get producer profile
router.get('/profile', authenticateProducer, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                producer_id,
                email,
                first_name,
                last_name,
                agency_name,
                phone,
                address_line1,
                address_line2,
                city,
                state,
                zip,
                status,
                created_at,
                last_login
            FROM producers
            WHERE producer_id = $1
        `, [req.producer.producerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producer not found' });
        }

        const producer = result.rows[0];

        // Get LOB access
        const lobAccess = await pool.query(`
            SELECT 
                lob.lob_id,
                lob.line_name,
                lob.description,
                pla.can_quote,
                pla.can_bind,
                pla.commission_rate
            FROM producer_lob_access pla
            JOIN portal_lines_of_business lob ON pla.lob_id = lob.lob_id
            WHERE pla.producer_id = $1 AND lob.is_active = true
            ORDER BY lob.display_order, lob.line_name
        `, [req.producer.producerId]);

        res.json({
            producer: producer,
            lobAccess: lobAccess.rows
        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update producer profile
router.put('/profile', authenticateProducer, async (req, res) => {
    try {
        const allowedFields = [
            'first_name', 'last_name', 'agency_name', 'phone',
            'address_line1', 'address_line2', 'city', 'state', 'zip'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Build update query
        const setClause = Object.keys(updates).map((field, index) => 
            `${field} = $${index + 2}`
        ).join(', ');

        const values = [req.producer.producerId, ...Object.values(updates)];

        const result = await pool.query(`
            UPDATE producers
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE producer_id = $1
            RETURNING producer_id, email, first_name, last_name, agency_name
        `, values);

        res.json({
            success: true,
            producer: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get available lines of business
router.get('/lines-of-business', authenticateProducer, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                lob.lob_id,
                lob.line_name,
                lob.line_code,
                lob.description,
                lob.min_premium,
                lob.max_premium,
                lob.auto_bind_limit,
                pla.can_quote,
                pla.can_bind,
                pla.commission_rate
            FROM portal_lines_of_business lob
            LEFT JOIN producer_lob_access pla ON 
                lob.lob_id = pla.lob_id AND pla.producer_id = $1
            WHERE lob.instance_id = $2 AND lob.is_active = true
            AND (pla.can_quote = true OR pla.can_quote IS NULL)
            ORDER BY lob.display_order, lob.line_name
        `, [req.producer.producerId, req.instanceId]);

        res.json({
            linesOfBusiness: result.rows
        });

    } catch (error) {
        console.error('Error fetching lines of business:', error);
        res.status(500).json({ error: 'Failed to fetch lines of business' });
    }
});

// Get producer's submissions
router.get('/submissions', authenticateProducer, async (req, res) => {
    try {
        const { status, lobId, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                s.submission_id,
                s.submission_uuid,
                s.route_id,
                s.status,
                s.workflow_step,
                s.form_data,
                s.ims_submission_guid,
                s.ims_quote_guid,
                s.ims_policy_number,
                s.submitted_at,
                s.processed_at,
                r.name as route_name,
                r.lob_id,
                lob.line_name
            FROM custom_route_submissions s
            JOIN producer_submissions ps ON s.submission_id = ps.submission_id
            JOIN custom_routes r ON s.route_id = r.route_id
            LEFT JOIN portal_lines_of_business lob ON r.lob_id = lob.lob_id
            WHERE ps.producer_id = $1
        `;

        const params = [req.producer.producerId];
        let paramIndex = 2;

        if (status) {
            query += ` AND s.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (lobId) {
            query += ` AND r.lob_id = $${paramIndex}`;
            params.push(lobId);
            paramIndex++;
        }

        query += ` ORDER BY s.submitted_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM custom_route_submissions s
            JOIN producer_submissions ps ON s.submission_id = ps.submission_id
            JOIN custom_routes r ON s.route_id = r.route_id
            WHERE ps.producer_id = $1
        `;

        const countParams = [req.producer.producerId];
        if (status) {
            countQuery += ' AND s.status = $2';
            countParams.push(status);
        }
        if (lobId) {
            countQuery += status ? ' AND r.lob_id = $3' : ' AND r.lob_id = $2';
            countParams.push(lobId);
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            submissions: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Get submission details
router.get('/submissions/:submissionId', authenticateProducer, async (req, res) => {
    try {
        const { submissionId } = req.params;

        // Verify producer owns this submission
        const result = await pool.query(`
            SELECT 
                s.*,
                r.name as route_name,
                lob.line_name,
                lob.line_code
            FROM custom_route_submissions s
            JOIN producer_submissions ps ON s.submission_id = ps.submission_id
            JOIN custom_routes r ON s.route_id = r.route_id
            LEFT JOIN portal_lines_of_business lob ON r.lob_id = lob.lob_id
            WHERE s.submission_id = $1 AND ps.producer_id = $2
        `, [submissionId, req.producer.producerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Get workflow log
        const workflowLog = await pool.query(`
            SELECT * FROM custom_route_workflow_log
            WHERE submission_id = $1
            ORDER BY created_at DESC
        `, [submissionId]);

        res.json({
            submission: result.rows[0],
            workflowLog: workflowLog.rows
        });

    } catch (error) {
        console.error('Error fetching submission:', error);
        res.status(500).json({ error: 'Failed to fetch submission' });
    }
});

// Get specific line of business details
router.get('/lines-of-business/:lobId', authenticateProducer, async (req, res) => {
    try {
        const { lobId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                lob.*,
                pla.can_quote,
                pla.can_bind,
                pla.commission_rate
            FROM portal_lines_of_business lob
            LEFT JOIN producer_lob_access pla ON 
                lob.lob_id = pla.lob_id AND pla.producer_id = $1
            WHERE lob.lob_id = $2 
            AND lob.instance_id = $3 
            AND lob.is_active = true
            AND (pla.can_quote = true OR pla.can_quote IS NULL)
        `, [req.producer.producerId, lobId, req.instanceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Line of business not found or not accessible' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching LOB details:', error);
        res.status(500).json({ error: 'Failed to fetch line of business details' });
    }
});

// Get form schema for LOB
router.get('/form-schemas/:formId', authenticateProducer, async (req, res) => {
    try {
        const { formId } = req.params;
        
        // Get form schema
        const result = await pool.query(`
            SELECT * FROM form_schemas 
            WHERE form_id = $1 AND instance_id = $2
        `, [formId, req.instanceId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Form schema not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching form schema:', error);
        res.status(500).json({ error: 'Failed to fetch form schema' });
    }
});

// Get draft submission for a specific LOB
router.get('/submissions/drafts/:lobId', authenticateProducer, async (req, res) => {
    try {
        const { lobId } = req.params;
        
        // Find the most recent draft for this producer and LOB
        const result = await pool.query(`
            SELECT 
                crs.*,
                cr.lob_id,
                plob.line_name,
                plob.line_code,
                ps.producer_id
            FROM custom_route_submissions crs
            JOIN custom_routes cr ON crs.route_id = cr.route_id
            JOIN producer_submissions ps ON crs.submission_id = ps.submission_id
            JOIN portal_lines_of_business plob ON cr.lob_id = plob.lob_id
            WHERE ps.producer_id = $1 
                AND cr.lob_id = $2 
                AND crs.status = 'draft'
                AND cr.instance_id = $3
            ORDER BY crs.created_at DESC
            LIMIT 1
        `, [req.producer.producerId, lobId, req.instanceId]);
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error('Error fetching draft:', error);
        res.status(500).json({ error: 'Failed to fetch draft submission' });
    }
});

// Update existing submission (for drafts)
router.put('/submissions/:submissionId', authenticateProducer, async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { form_data, status } = req.body;
        
        console.log('Updating draft submission:', submissionId, 'with status:', status);
        
        // Verify producer owns this submission
        const ownerCheck = await pool.query(
            'SELECT submission_id FROM producer_submissions WHERE submission_id = $1 AND producer_id = $2',
            [submissionId, req.producer.producerId]
        );
        
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Update the submission in custom_route_submissions
        const result = await pool.query(`
            UPDATE custom_route_submissions 
            SET form_data = $1,
                status = COALESCE($2, status)
            WHERE submission_id = $3
            RETURNING submission_id
        `, [form_data, status, submissionId]);
        
        res.json({ 
            success: true, 
            submission_id: result.rows[0].submission_id 
        });
        
    } catch (error) {
        console.error('Error updating submission:', error);
        res.status(500).json({ error: 'Failed to update submission' });
    }
});

// Create new submission
router.post('/submissions', authenticateProducer, async (req, res) => {
    let submissionId = null;
    
    try {
        const { lob_id, form_data, status = 'pending', is_draft = false } = req.body;
        
        console.log('Creating new submission - LOB:', lob_id, 'Status:', status, 'Is Draft:', is_draft);
        
        if (!lob_id || !form_data) {
            return res.status(400).json({ error: 'Line of business and form data are required' });
        }
        
        // Verify producer has access to this LOB
        const lobCheck = await pool.query(`
            SELECT 
                lob.lob_id,
                lob.line_name,
                pla.can_quote
            FROM portal_lines_of_business lob
            LEFT JOIN producer_lob_access pla ON 
                lob.lob_id = pla.lob_id AND pla.producer_id = $1
            WHERE lob.lob_id = $2 
            AND lob.instance_id = $3 
            AND lob.is_active = true
            AND (pla.can_quote = true OR pla.can_quote IS NULL)
        `, [req.producer.producerId, lob_id, req.instanceId]);
        
        if (lobCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this line of business' });
        }
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Check if a custom route exists for this LOB
            let routeResult = await client.query(`
                SELECT route_id FROM custom_routes 
                WHERE lob_id = $1 AND instance_id = $2 AND is_active = true
                LIMIT 1
            `, [lob_id, req.instanceId]);
            
            let routeId;
            if (routeResult.rows.length === 0) {
                // Create a default route for this LOB
                const routeInsert = await client.query(`
                    INSERT INTO custom_routes (
                        instance_id, name, description, slug,
                        route_category, lob_id, is_active,
                        workflow_config
                    ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                    RETURNING route_id
                `, [
                    req.instanceId,
                    `Producer Portal - ${lobCheck.rows[0].line_name}`,
                    'Auto-generated route for producer portal submissions',
                    `producer-portal-lob-${lob_id}`,
                    'producer-only',
                    lob_id,
                    JSON.stringify({
                        steps: ['validate', 'submit_to_ims', 'complete']
                    })
                ]);
                routeId = routeInsert.rows[0].route_id;
            } else {
                routeId = routeResult.rows[0].route_id;
            }
            
            // Create submission
            const submissionResult = await client.query(`
                INSERT INTO custom_route_submissions (
                    route_id, status, workflow_step, form_data,
                    applicant_email, applicant_name
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [
                routeId, 
                status, 
                'initial', 
                form_data,
                req.producer.email,
                `${req.producer.firstName} ${req.producer.lastName}`
            ]);
            
            const submission = submissionResult.rows[0];
            submissionId = submission.submission_id;
            
            // Link submission to producer
            await client.query(`
                INSERT INTO producer_submissions (
                    producer_id, submission_id, created_at
                ) VALUES ($1, $2, CURRENT_TIMESTAMP)
            `, [req.producer.producerId, submission.submission_id]);
            
            // Log activity
            await client.query(`
                INSERT INTO producer_audit_log (
                    producer_id, action, details, created_at
                ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            `, [
                req.producer.producerId,
                'submission_created',
                JSON.stringify({
                    submission_id: submission.submission_id,
                    lob_id: lob_id,
                    line_name: lobCheck.rows[0].line_name
                })
            ]);
            
            await client.query('COMMIT');
            
            res.status(201).json({
                submission_id: submission.submission_id,
                submission_uuid: submission.submission_uuid,
                status: submission.status,
                submitted_at: submission.submitted_at,
                message: 'Submission created successfully. Processing will begin shortly.'
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
        // Process submission asynchronously AFTER sending response
        // Only process if NOT a draft
        if (submissionId && status !== 'draft') {
            try {
                const ProducerSubmissionProcessor = require('../services/producerSubmissionProcessor');
                const processor = new ProducerSubmissionProcessor();
                
                // Process in background
                processor.processSubmission(submissionId, req.producer.producerId)
                    .then(result => {
                        console.log('Submission processed successfully:', {
                            submissionId: submissionId,
                            controlNumber: result.controlNumber,
                            premium: result.premium
                        });
                    })
                    .catch(error => {
                        console.error('Failed to process submission:', error);
                    });
            } catch (error) {
                console.error('Error starting submission processor:', error);
            }
        }
        
    } catch (error) {
        console.error('Error creating submission:', error);
        res.status(500).json({ error: 'Failed to create submission' });
    }
});

// Delete draft submission
router.delete('/submissions/:submissionId', authenticateProducer, async (req, res) => {
    try {
        const { submissionId } = req.params;
        
        // First, verify the submission exists and is owned by this producer
        const checkResult = await pool.query(`
            SELECT s.status, s.submission_uuid
            FROM custom_route_submissions s
            JOIN producer_submissions ps ON s.submission_id = ps.submission_id
            WHERE s.submission_id = $1 AND ps.producer_id = $2
        `, [submissionId, req.producer.producerId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        const submission = checkResult.rows[0];
        
        // Only allow deletion of draft submissions
        if (submission.status !== 'draft') {
            return res.status(403).json({ error: 'Only draft submissions can be deleted' });
        }
        
        // Use a transaction to delete from both tables
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Delete from producer_submissions first (foreign key constraint)
            await client.query(
                'DELETE FROM producer_submissions WHERE submission_id = $1',
                [submissionId]
            );
            
            // Delete from custom_route_submissions
            await client.query(
                'DELETE FROM custom_route_submissions WHERE submission_id = $1',
                [submissionId]
            );
            
            // Log the deletion
            await client.query(`
                INSERT INTO producer_audit_log (producer_id, action, details, created_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            `, [
                req.producer.producerId,
                'draft_deleted',
                JSON.stringify({
                    submission_id: submissionId,
                    submission_uuid: submission.submission_uuid
                })
            ]);
            
            await client.query('COMMIT');
            
            res.json({ 
                success: true, 
                message: 'Draft submission deleted successfully' 
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({ error: 'Failed to delete submission' });
    }
});

// Get submission processing status
router.get('/submissions/:submissionId/status', authenticateProducer, async (req, res) => {
    try {
        const { submissionId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                s.submission_id,
                s.submission_uuid,
                s.status,
                s.workflow_step,
                s.ims_submission_guid,
                s.ims_quote_guid,
                s.form_data->'imsResults'->>'controlNumber' as control_number,
                s.form_data->'imsResults'->>'premium' as premium,
                s.form_data->'error' as error_message,
                s.created_at,
                s.updated_at
            FROM custom_route_submissions s
            JOIN producer_submissions ps ON s.submission_id = ps.submission_id
            WHERE s.submission_id = $1 AND ps.producer_id = $2
        `, [submissionId, req.producer.producerId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        const submission = result.rows[0];
        
        res.json({
            submission_id: submission.submission_id,
            submission_uuid: submission.submission_uuid,
            status: submission.status,
            workflow_step: submission.workflow_step,
            control_number: submission.control_number,
            premium: submission.premium ? parseFloat(submission.premium) : null,
            error_message: submission.error_message,
            ims_quote_guid: submission.ims_quote_guid,
            created_at: submission.created_at,
            updated_at: submission.updated_at,
            processing_complete: submission.status === 'quoted' || submission.status === 'failed'
        });
        
    } catch (error) {
        console.error('Error fetching submission status:', error);
        res.status(500).json({ error: 'Failed to fetch submission status' });
    }
});

// Manually trigger submission processing (useful for retries)
router.post('/submissions/:submissionId/process', authenticateProducer, async (req, res) => {
    try {
        const { submissionId } = req.params;
        
        // Verify ownership
        const check = await pool.query(`
            SELECT s.submission_id, s.status
            FROM custom_route_submissions s
            JOIN producer_submissions ps ON s.submission_id = ps.submission_id
            WHERE s.submission_id = $1 AND ps.producer_id = $2
        `, [submissionId, req.producer.producerId]);
        
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        if (check.rows[0].status === 'processing') {
            return res.status(400).json({ error: 'Submission is already being processed' });
        }
        
        const ProducerSubmissionProcessor = require('../services/producerSubmissionProcessor');
        const processor = new ProducerSubmissionProcessor();
        
        // Process synchronously for immediate response
        const result = await processor.processSubmission(submissionId, req.producer.producerId);
        
        res.json({
            success: true,
            message: 'Submission processed successfully',
            control_number: result.controlNumber,
            quote_guid: result.quoteGuid,
            premium: result.premium
        });
        
    } catch (error) {
        console.error('Error processing submission:', error);
        res.status(500).json({ 
            error: 'Failed to process submission',
            details: error.message 
        });
    }
});

module.exports = router;