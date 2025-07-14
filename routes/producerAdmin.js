const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const producerManagementService = require('../services/producerManagementService');
const pool = require('../config/db');
const ratingTypeService = require('../services/ratingTypeService');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Accept Excel files only
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel files are allowed.'), false);
        }
    }
});

// All routes require authentication and appropriate permissions
router.use(auth);

// Middleware to check producer portal permissions - DISABLED for now
const requirePermission = (permission) => {
    return (req, res, next) => {
        // Skip permission check for now
        next();
    };
};

// Get producer portal configuration
router.get('/config', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        
        console.log('Getting portal config for instanceId:', instanceId);
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        const result = await pool.query(`
            SELECT ppc.*, i.custom_domain, i.is_custom_domain_approved
            FROM producer_portal_config ppc
            JOIN ims_instances i ON ppc.instance_id = i.instance_id
            WHERE ppc.instance_id = $1
        `, [instanceId]);

        console.log('Portal config query result:', result.rows.length, 'rows');
        if (result.rows.length > 0) {
            console.log('Config data:', result.rows[0]);
        }

        if (result.rows.length === 0) {
            // Get custom_domain from instance
            const instanceResult = await pool.query(`
                SELECT custom_domain, is_custom_domain_approved 
                FROM ims_instances WHERE instance_id = $1
            `, [instanceId]);
            
            // Return empty config instead of 404
            return res.json({
                instance_id: instanceId,
                portal_name: '',
                logo_url: '',
                primary_color: '#007bff',
                secondary_color: '#6c757d',
                custom_css: '',
                custom_js: '',
                welcome_message: '',
                is_active: false,
                subdomain: instanceResult.rows[0]?.subdomain || null,
                custom_domain: instanceResult.rows[0]?.custom_domain || null,
                is_custom_domain_approved: instanceResult.rows[0]?.is_custom_domain_approved || false
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching portal config:', error);
        res.status(500).json({ error: 'Failed to fetch portal configuration' });
    }
});

// Update producer portal configuration
router.put('/config', async (req, res) => {
    try {
        const {
            instanceId,
            portal_name,
            logo_url,
            primary_color,
            secondary_color,
            custom_css,
            custom_js,
            welcome_message,
            terms_of_service,
            is_active
        } = req.body;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }

        const result = await pool.query(`
            INSERT INTO producer_portal_config (
                instance_id, portal_name, logo_url, primary_color, 
                secondary_color, custom_css, custom_js, welcome_message, 
                terms_of_service, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (instance_id) 
            DO UPDATE SET 
                portal_name = COALESCE(EXCLUDED.portal_name, producer_portal_config.portal_name),
                logo_url = COALESCE(EXCLUDED.logo_url, producer_portal_config.logo_url),
                primary_color = COALESCE(EXCLUDED.primary_color, producer_portal_config.primary_color),
                secondary_color = COALESCE(EXCLUDED.secondary_color, producer_portal_config.secondary_color),
                custom_css = COALESCE(EXCLUDED.custom_css, producer_portal_config.custom_css),
                custom_js = COALESCE(EXCLUDED.custom_js, producer_portal_config.custom_js),
                welcome_message = COALESCE(EXCLUDED.welcome_message, producer_portal_config.welcome_message),
                terms_of_service = COALESCE(EXCLUDED.terms_of_service, producer_portal_config.terms_of_service),
                is_active = COALESCE(EXCLUDED.is_active, producer_portal_config.is_active),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            instanceId, portal_name, logo_url, primary_color, secondary_color,
            custom_css, custom_js, welcome_message, terms_of_service, is_active
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating portal config:', error);
        res.status(500).json({ error: 'Failed to update portal configuration' });
    }
});

// Get all producers
router.get('/producers', requirePermission('producer_portal.producers.view'), async (req, res) => {
    try {
        const { status, search, instanceId } = req.query;
        const filters = { status, search };

        // Use instanceId from query if provided, otherwise fall back to user's instanceId
        const targetInstanceId = instanceId || req.user.instanceId;
        
        if (!targetInstanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }

        console.log('Fetching producers for instance:', targetInstanceId, 'with filters:', filters);
        
        const producers = await producerManagementService.getProducers(
            targetInstanceId,
            filters
        );
        
        console.log('Found producers:', producers.length);

        res.json(producers);
    } catch (error) {
        console.error('Error fetching producers:', error);
        res.status(500).json({ error: 'Failed to fetch producers' });
    }
});

// Get producer details
router.get('/producers/:producerId', requirePermission('producer_portal.producers.view'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { instanceId } = req.query;
        const targetInstanceId = instanceId || req.user.instanceId;

        const details = await producerManagementService.getProducerDetails(
            producerId,
            targetInstanceId
        );

        if (!details) {
            return res.status(404).json({ error: 'Producer not found' });
        }

        res.json(details);
    } catch (error) {
        console.error('Error fetching producer details:', error);
        res.status(500).json({ error: 'Failed to fetch producer details' });
    }
});

// Approve producer
router.post('/producers/:producerId/approve', requirePermission('producer_portal.producers.approve'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { instanceId } = req.query;
        const { lobAccess } = req.body;
        const targetInstanceId = instanceId || req.user.instanceId;

        const result = await producerManagementService.approveProducer(
            producerId,
            targetInstanceId,
            req.user.user_id || req.user.userId,
            lobAccess
        );

        res.json({
            success: true,
            producer: result
        });
    } catch (error) {
        console.error('Error approving producer:', error);
        if (error.message === 'Producer not found or already processed') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to approve producer' });
    }
});

// Reject producer
router.post('/producers/:producerId/reject', requirePermission('producer_portal.producers.approve'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { instanceId } = req.query;
        const { reason } = req.body;
        const targetInstanceId = instanceId || req.user.instanceId;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason required' });
        }

        const result = await producerManagementService.rejectProducer(
            producerId,
            targetInstanceId,
            req.user.user_id || req.user.userId,
            reason
        );

        res.json({
            success: true,
            producer: result
        });
    } catch (error) {
        console.error('Error rejecting producer:', error);
        res.status(500).json({ error: 'Failed to reject producer' });
    }
});

// Get all producers for an instance
router.get('/producers', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }
        
        const result = await pool.query(`
            SELECT 
                p.*,
                pc.subdomain,
                COUNT(DISTINCT ps.submission_id) as submission_count
            FROM producers p
            LEFT JOIN producer_configurations pc ON p.producer_id = pc.producer_id
            LEFT JOIN producer_submissions ps ON p.producer_id = ps.producer_id
            WHERE p.instance_id = $1
            GROUP BY p.producer_id, pc.subdomain
            ORDER BY p.created_at DESC
        `, [instanceId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching producers:', error);
        res.status(500).json({ error: 'Failed to fetch producers' });
    }
});

// Search IMS for producer by email
router.post('/producers/search-ims', requirePermission('producer_portal.manage'), async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        const IMSService = require('../services/imsService');
        const imsService = new IMSService();
        
        // Search for producer contact in IMS by email
        const results = await imsService.searchProducerByEmail(email);
        
        res.json({
            success: true,
            results: results || []
        });
        
    } catch (error) {
        console.error('Error searching IMS:', error);
        res.status(500).json({ error: 'Failed to search IMS' });
    }
});

// Link producer to IMS contact
router.post('/producers/:producerId/link-ims', requirePermission('producer_portal.manage'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { ims_contact_guid, ims_producer_location_guid } = req.body;
        
        if (!ims_contact_guid) {
            return res.status(400).json({ error: 'IMS contact GUID is required' });
        }
        
        const result = await pool.query(`
            UPDATE producers 
            SET 
                ims_contact_guid = $2,
                ims_producer_location_guid = $3,
                producer_guid = COALESCE(producer_guid, gen_random_uuid()),
                updated_at = CURRENT_TIMESTAMP
            WHERE producer_id = $1
            RETURNING producer_id, email, ims_contact_guid
        `, [producerId, ims_contact_guid, ims_producer_location_guid]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producer not found' });
        }
        
        res.json({
            success: true,
            producer: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error linking producer:', error);
        res.status(500).json({ error: 'Failed to link producer to IMS' });
    }
});

// Update producer status
router.put('/producers/:producerId/status', requirePermission('producer_portal.producers.manage'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { status, reason } = req.body;

        const result = await producerManagementService.updateProducerStatus(
            producerId,
            req.user.instanceId,
            status,
            req.user.userId,
            reason
        );

        res.json({
            success: true,
            producer: result
        });
    } catch (error) {
        console.error('Error updating producer status:', error);
        res.status(500).json({ error: 'Failed to update producer status' });
    }
});

// Update producer LOB access
router.put('/producers/:producerId/lob-access', requirePermission('producer_portal.producers.manage'), async (req, res) => {
    try {
        const { producerId } = req.params;
        const { lobAccess } = req.body;

        if (!Array.isArray(lobAccess)) {
            return res.status(400).json({ error: 'lobAccess must be an array' });
        }

        await producerManagementService.updateProducerLOBAccess(
            producerId,
            req.user.instanceId,
            lobAccess
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating LOB access:', error);
        res.status(500).json({ error: 'Failed to update LOB access' });
    }
});

// Get available rating types from IMS
router.get('/rating-types', requirePermission('producer_portal.lob.manage'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Get instance configuration
        const instanceResult = await pool.query(
            'SELECT url, username, password FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }
        
        const instanceConfig = instanceResult.rows[0];
        
        // Fetch rating types from IMS
        const ratingTypes = await ratingTypeService.getRatingTypes(instanceConfig);
        
        res.json(ratingTypes);
    } catch (error) {
        console.error('Error fetching rating types:', error);
        res.status(500).json({ error: 'Failed to fetch rating types' });
    }
});

// Get lines of business
router.get('/lines-of-business', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }
        
        const result = await pool.query(`
            SELECT * FROM portal_lines_of_business
            WHERE instance_id = $1
            ORDER BY display_order, line_name
        `, [instanceId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching lines of business:', error);
        res.status(500).json({ error: 'Failed to fetch lines of business' });
    }
});

// Get single line of business
router.get('/lines-of-business/:lobId', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { lobId } = req.params;
        const { instanceId } = req.query;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }
        
        const result = await pool.query(`
            SELECT * FROM portal_lines_of_business
            WHERE lob_id = $1 AND instance_id = $2
        `, [lobId, instanceId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Line of business not found' });
        }
        
        // Get premium mappings
        const mappingsResult = await pool.query(`
            SELECT sheet_name, cell_reference, priority
            FROM excel_premium_mappings
            WHERE lob_id = $1 AND mapping_type = 'premium'
            ORDER BY priority ASC
        `, [lobId]);
        
        const lob = result.rows[0];
        lob.premium_mappings = mappingsResult.rows;

        res.json(lob);
    } catch (error) {
        console.error('Error fetching line of business:', error);
        res.status(500).json({ error: 'Failed to fetch line of business' });
    }
});

// Update line of business
router.put('/lines-of-business/:lobId', requirePermission('producer_portal.lob.manage'), upload.single('rater_file'), async (req, res) => {
    try {
        const { lobId } = req.params;
        const { instanceId } = req.query;
        const {
            line_name,
            line_code,
            description,
            ims_line_guid,
            ims_company_guid,
            ims_rating_type_id,
            ims_rating_type_name,
            ims_procedure_name,
            excel_formula_calculation,
            formula_calc_method,
            premium_mappings
        } = req.body;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }
        
        // Build update query dynamically based on whether file is uploaded
        let updateQuery;
        let queryParams;
        
        if (req.file) {
            // Update including file
            updateQuery = `
                UPDATE portal_lines_of_business
                SET line_name = $1,
                    line_code = $2,
                    description = $3,
                    ims_line_guid = $4,
                    ims_company_guid = $5,
                    ims_rating_type_id = $6,
                    ims_rating_type_name = $7,
                    ims_procedure_name = $8,
                    rater_file_name = $9,
                    rater_file_data = $10,
                    rater_file_content_type = $11,
                    rater_file_uploaded_at = $12,
                    excel_formula_calculation = $13,
                    formula_calc_method = $14,
                    updated_at = CURRENT_TIMESTAMP
                WHERE lob_id = $15 AND instance_id = $16
                RETURNING lob_id, instance_id, line_name, line_code, description,
                         ims_line_guid, ims_company_guid, ims_procedure_name,
                         ims_rating_type_id, ims_rating_type_name,
                         rater_file_name, rater_file_uploaded_at,
                         excel_formula_calculation, formula_calc_method,
                         is_active, created_at, updated_at
            `;
            queryParams = [
                line_name, line_code, description, ims_line_guid, ims_company_guid,
                ims_rating_type_id, ims_rating_type_name, ims_procedure_name,
                req.file.originalname, req.file.buffer, req.file.mimetype, new Date(),
                excel_formula_calculation !== 'false', formula_calc_method || 'none',
                lobId, instanceId
            ];
        } else {
            // Update without file
            updateQuery = `
                UPDATE portal_lines_of_business
                SET line_name = $1,
                    line_code = $2,
                    description = $3,
                    ims_line_guid = $4,
                    ims_company_guid = $5,
                    ims_rating_type_id = $6,
                    ims_rating_type_name = $7,
                    ims_procedure_name = $8,
                    excel_formula_calculation = $9,
                    formula_calc_method = $10,
                    updated_at = CURRENT_TIMESTAMP
                WHERE lob_id = $11 AND instance_id = $12
                RETURNING lob_id, instance_id, line_name, line_code, description,
                         ims_line_guid, ims_company_guid, ims_procedure_name,
                         ims_rating_type_id, ims_rating_type_name,
                         rater_file_name, rater_file_uploaded_at,
                         excel_formula_calculation, formula_calc_method,
                         is_active, created_at, updated_at
            `;
            queryParams = [
                line_name, line_code, description, ims_line_guid, ims_company_guid,
                ims_rating_type_id, ims_rating_type_name, ims_procedure_name,
                excel_formula_calculation !== 'false', formula_calc_method || 'none',
                lobId, instanceId
            ];
        }
        
        const result = await pool.query(updateQuery, queryParams);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Line of business not found' });
        }
        
        // Handle premium mappings if provided
        if (premium_mappings) {
            try {
                const mappings = JSON.parse(premium_mappings);
                
                // Delete existing mappings
                await pool.query(
                    'DELETE FROM excel_premium_mappings WHERE lob_id = $1',
                    [lobId]
                );
                
                // Insert new mappings
                for (const mapping of mappings) {
                    await pool.query(`
                        INSERT INTO excel_premium_mappings 
                        (lob_id, sheet_name, cell_reference, mapping_type, priority)
                        VALUES ($1, $2, $3, 'premium', $4)
                    `, [lobId, mapping.sheet_name, mapping.cell_reference, mapping.priority]);
                }
            } catch (mappingError) {
                console.error('Error updating premium mappings:', mappingError);
                // Continue even if mappings fail
            }
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating line of business:', error);
        res.status(500).json({ error: 'Failed to update line of business' });
    }
});

// Download rater file
router.get('/lines-of-business/:lobId/rater-file', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { lobId } = req.params;
        const { instanceId } = req.query;
        
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }
        
        const result = await pool.query(`
            SELECT rater_file_name, rater_file_data, rater_file_content_type
            FROM portal_lines_of_business
            WHERE lob_id = $1 AND instance_id = $2
        `, [lobId, instanceId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Line of business not found' });
        }
        
        const { rater_file_name, rater_file_data, rater_file_content_type } = result.rows[0];
        
        if (!rater_file_data) {
            return res.status(404).json({ error: 'No rater file uploaded for this line of business' });
        }
        
        res.set({
            'Content-Type': rater_file_content_type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${rater_file_name || 'rater.xlsx'}"`
        });
        
        res.send(rater_file_data);
    } catch (error) {
        console.error('Error downloading rater file:', error);
        res.status(500).json({ error: 'Failed to download rater file' });
    }
});

// Create line of business
router.post('/lines-of-business', requirePermission('producer_portal.lob.manage'), upload.single('rater_file'), async (req, res) => {
    try {
        const {
            instanceId,
            line_name,
            line_code,
            description,
            ims_line_guid,
            ims_company_guid,
            ims_procedure_id,
            ims_procedure_name,
            ims_company_location_guid,
            ims_quoting_location_guid,
            ims_issuing_location_guid,
            ims_rating_type_id,
            ims_rating_type_name,
            ims_underwriter_guid,
            ims_producer_contact_guid,
            ims_producer_location_guid,
            rater_template_path,
            rater_config,
            min_premium,
            max_premium,
            auto_bind_limit,
            requires_underwriter_approval,
            display_order,
            form_config
        } = req.body;
        
        // Validate instanceId
        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        // Verify user has access to this instance
        const instanceCheck = await pool.query(
            'SELECT instance_id FROM ims_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, req.user.user_id]
        );
        
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this instance' });
        }

        // Handle file data if uploaded
        let rater_file_name = null;
        let rater_file_data = null;
        let rater_file_content_type = null;
        
        if (req.file) {
            rater_file_name = req.file.originalname;
            rater_file_data = req.file.buffer;
            rater_file_content_type = req.file.mimetype;
        }

        const result = await pool.query(`
            INSERT INTO portal_lines_of_business (
                instance_id, line_name, line_code, description,
                ims_line_guid, ims_company_guid, ims_procedure_name,
                ims_company_location_guid,
                ims_quoting_location_guid, ims_issuing_location_guid,
                ims_rating_type_id, ims_rating_type_name,
                ims_underwriter_guid, ims_producer_contact_guid, ims_producer_location_guid,
                rater_template_path, rater_config, form_config,
                min_premium, max_premium, auto_bind_limit,
                requires_underwriter_approval, display_order,
                rater_file_name, rater_file_data, rater_file_content_type, rater_file_uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
            RETURNING lob_id, instance_id, line_name, line_code, description,
                     ims_line_guid, ims_company_guid, ims_procedure_name,
                     ims_rating_type_id, ims_rating_type_name,
                     ims_underwriter_guid, ims_producer_contact_guid, ims_producer_location_guid,
                     rater_file_name, rater_file_uploaded_at,
                     is_active, created_at, updated_at
        `, [
            instanceId, line_name, line_code, description,
            ims_line_guid, ims_company_guid, ims_procedure_name,
            ims_company_location_guid,
            ims_quoting_location_guid, ims_issuing_location_guid,
            ims_rating_type_id && ims_rating_type_id !== '0' ? parseInt(ims_rating_type_id) : null, 
            ims_rating_type_name,
            ims_underwriter_guid || null,
            ims_producer_contact_guid || null,
            ims_producer_location_guid || null,
            rater_template_path, JSON.stringify(rater_config || {}),
            JSON.stringify(form_config || {}),
            min_premium, max_premium, auto_bind_limit,
            requires_underwriter_approval, display_order || 0,
            rater_file_name, rater_file_data, rater_file_content_type,
            rater_file_data ? new Date() : null
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating line of business:', error);
        res.status(500).json({ error: 'Failed to create line of business' });
    }
});

// Update line of business
router.put('/lines-of-business/:lobId', requirePermission('producer_portal.lob.manage'), async (req, res) => {
    try {
        const { lobId } = req.params;
        const updates = req.body;

        // Build dynamic update query
        const allowedFields = [
            'line_name', 'line_code', 'description',
            'ims_line_guid', 'ims_company_location_guid',
            'ims_quoting_location_guid', 'ims_issuing_location_guid',
            'ims_rating_type_id', 'ims_rating_type_name',
            'rater_template_path', 'rater_config',
            'min_premium', 'max_premium', 'auto_bind_limit',
            'requires_underwriter_approval', 'display_order', 'is_active'
        ];

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                setClause.push(`${field} = $${paramIndex}`);
                values.push(field === 'rater_config' ? JSON.stringify(updates[field]) : updates[field]);
                paramIndex++;
            }
        }

        if (setClause.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(lobId, req.user.instanceId);

        const result = await pool.query(`
            UPDATE portal_lines_of_business
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE lob_id = $${paramIndex} AND instance_id = $${paramIndex + 1}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Line of business not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating line of business:', error);
        res.status(500).json({ error: 'Failed to update line of business' });
    }
});

// Get producer statistics
router.get('/statistics', requirePermission('producer_portal.view'), async (req, res) => {
    try {
        const { instanceId } = req.query;
        const targetInstanceId = instanceId || req.user.instanceId;
        
        if (!targetInstanceId) {
            return res.status(400).json({ error: 'Instance ID is required' });
        }
        
        const stats = await producerManagementService.getProducerStatistics(targetInstanceId);

        // Get submission statistics
        const submissionStats = await pool.query(`
            SELECT 
                COUNT(DISTINCT s.submission_id) as total_submissions,
                COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.submission_id END) as completed_submissions,
                COUNT(DISTINCT CASE WHEN s.ims_policy_number IS NOT NULL THEN s.submission_id END) as bound_policies,
                COUNT(DISTINCT ps.producer_id) as active_producers,
                COUNT(DISTINCT CASE WHEN s.submitted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN s.submission_id END) as submissions_last_30_days
            FROM producer_submissions ps
            JOIN custom_route_submissions s ON ps.submission_id = s.submission_id
            JOIN producers p ON ps.producer_id = p.producer_id
            WHERE p.instance_id = $1
        `, [targetInstanceId]);

        res.json({
            producers: stats,
            submissions: submissionStats.rows[0]
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get producer activity logs
router.get('/activity', requirePermission('producer_portal.producers.view'), async (req, res) => {
    try {
        const { days = 30, producerId } = req.query;

        let query = `
            SELECT 
                pal.*,
                p.first_name,
                p.last_name,
                p.agency_name,
                p.email
            FROM producer_audit_log pal
            JOIN producers p ON pal.producer_id = p.producer_id
            WHERE p.instance_id = $1
            AND pal.created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
        `;

        const params = [req.user.instanceId, days];

        if (producerId) {
            query += ' AND pal.producer_id = $3';
            params.push(producerId);
        }

        query += ' ORDER BY pal.created_at DESC LIMIT 100';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

// Quick endpoint to verify producer email (for development)
router.post('/verify-email-dev', requirePermission('producer_portal.manage'), async (req, res) => {
    try {
        const { email } = req.body;
        
        const result = await pool.query(
            'UPDATE producers SET email_verified = true WHERE email = $1 RETURNING producer_id, email, first_name, last_name',
            [email]
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true, producer: result.rows[0] });
        } else {
            res.status(404).json({ error: 'Producer not found' });
        }
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ error: 'Failed to verify email' });
    }
});

module.exports = router;