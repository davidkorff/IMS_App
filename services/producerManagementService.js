const pool = require('../config/db');
// const imsService = require('./imsService'); // TODO: Implement IMS integration

class ProducerManagementService {
    /**
     * Get all producers for an instance (admin function)
     */
    async getProducers(instanceId, filters = {}) {
        let query = `
            SELECT 
                p.*,
                COUNT(DISTINCT ps.submission_id) as total_submissions,
                COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.submission_id END) as completed_submissions
            FROM producers p
            LEFT JOIN producer_submissions ps ON p.producer_id = ps.producer_id
            LEFT JOIN custom_route_submissions s ON ps.submission_id = s.submission_id
            WHERE p.instance_id = $1
        `;

        const params = [instanceId];
        let paramIndex = 2;

        if (filters.status) {
            query += ` AND p.status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters.search) {
            query += ` AND (
                LOWER(p.email) LIKE LOWER($${paramIndex}) OR
                LOWER(p.first_name) LIKE LOWER($${paramIndex}) OR
                LOWER(p.last_name) LIKE LOWER($${paramIndex}) OR
                LOWER(p.agency_name) LIKE LOWER($${paramIndex})
            )`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        query += ` GROUP BY p.producer_id ORDER BY p.created_at DESC`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Get producer details
     */
    async getProducerDetails(producerId, instanceId) {
        const client = await pool.connect();
        try {
            // Get producer info
            const producerResult = await client.query(`
                SELECT * FROM producers 
                WHERE producer_id = $1 AND instance_id = $2
            `, [producerId, instanceId]);

            if (producerResult.rows.length === 0) {
                return null;
            }

            const producer = producerResult.rows[0];

            // Get LOB access
            const lobAccessResult = await client.query(`
                SELECT 
                    pla.*,
                    lob.line_name,
                    lob.line_code
                FROM producer_lob_access pla
                JOIN portal_lines_of_business lob ON pla.lob_id = lob.lob_id
                WHERE pla.producer_id = $1
            `, [producerId]);

            // Get recent activity
            const activityResult = await client.query(`
                SELECT * FROM producer_audit_log
                WHERE producer_id = $1
                ORDER BY created_at DESC
                LIMIT 50
            `, [producerId]);

            // Get submission statistics
            const statsResult = await client.query(`
                SELECT 
                    COUNT(*) as total_submissions,
                    COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_submissions,
                    COUNT(CASE WHEN s.status = 'quoted' THEN 1 END) as quoted_submissions,
                    COUNT(CASE WHEN s.ims_policy_number IS NOT NULL THEN 1 END) as bound_policies,
                    MIN(s.submitted_at) as first_submission,
                    MAX(s.submitted_at) as last_submission
                FROM producer_submissions ps
                JOIN custom_route_submissions s ON ps.submission_id = s.submission_id
                WHERE ps.producer_id = $1
            `, [producerId]);

            return {
                producer: producer,
                lobAccess: lobAccessResult.rows,
                recentActivity: activityResult.rows,
                statistics: statsResult.rows[0]
            };

        } finally {
            client.release();
        }
    }

    /**
     * Approve a producer
     */
    async approveProducer(producerId, instanceId, approvedBy, lobAccess = []) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update producer status
            const updateResult = await client.query(`
                UPDATE producers 
                SET status = 'approved',
                    approved_at = CURRENT_TIMESTAMP,
                    approved_by = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE producer_id = $2 AND instance_id = $3 AND status = 'pending'
                RETURNING *
            `, [approvedBy, producerId, instanceId]);

            if (updateResult.rows.length === 0) {
                throw new Error('Producer not found or already processed');
            }

            const producer = updateResult.rows[0];

            // Create producer in IMS if configured
            if (producer.email && !producer.ims_producer_guid) {
                try {
                    const imsProducer = await this.createProducerInIMS(producer);
                    if (imsProducer) {
                        await client.query(`
                            UPDATE producers 
                            SET ims_producer_guid = $1,
                                ims_producer_contact_guid = $2,
                                ims_producer_location_guid = $3
                            WHERE producer_id = $4
                        `, [
                            imsProducer.producerGuid,
                            imsProducer.contactGuid,
                            imsProducer.locationGuid,
                            producerId
                        ]);
                    }
                } catch (imsError) {
                    console.error('Failed to create producer in IMS:', imsError);
                    // Continue anyway - IMS sync can be done later
                }
            }

            // Set up LOB access
            if (lobAccess && lobAccess.length > 0) {
                for (const access of lobAccess) {
                    await client.query(`
                        INSERT INTO producer_lob_access 
                        (producer_id, lob_id, can_quote, can_bind, commission_rate)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (producer_id, lob_id) 
                        DO UPDATE SET 
                            can_quote = EXCLUDED.can_quote,
                            can_bind = EXCLUDED.can_bind,
                            commission_rate = EXCLUDED.commission_rate
                    `, [
                        producerId,
                        access.lobId,
                        access.canQuote !== false, // Default true
                        access.canBind || false,
                        access.commissionRate || 0
                    ]);
                }
            }

            // Log approval
            await client.query(`
                INSERT INTO producer_audit_log (producer_id, action, details)
                VALUES ($1, 'approved', $2)
            `, [producerId, JSON.stringify({ approvedBy, lobAccess })]);

            await client.query('COMMIT');

            // TODO: Send approval email to producer

            return producer;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Reject a producer application
     */
    async rejectProducer(producerId, instanceId, rejectedBy, reason) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const updateResult = await client.query(`
                UPDATE producers 
                SET status = 'rejected',
                    notes = COALESCE(notes, '') || '\nRejected: ' || $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE producer_id = $2 AND instance_id = $3 AND status = 'pending'
                RETURNING email, first_name
            `, [reason, producerId, instanceId]);

            if (updateResult.rows.length === 0) {
                throw new Error('Producer not found or already processed');
            }

            // Log rejection
            await client.query(`
                INSERT INTO producer_audit_log (producer_id, action, details)
                VALUES ($1, 'rejected', $2)
            `, [producerId, JSON.stringify({ rejectedBy, reason })]);

            await client.query('COMMIT');

            // TODO: Send rejection email

            return updateResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Suspend/unsuspend a producer
     */
    async updateProducerStatus(producerId, instanceId, newStatus, updatedBy, reason) {
        const validStatuses = ['approved', 'suspended', 'inactive'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error('Invalid status');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const updateResult = await client.query(`
                UPDATE producers 
                SET status = $1,
                    notes = CASE 
                        WHEN $2 IS NOT NULL 
                        THEN COALESCE(notes, '') || '\n' || $2
                        ELSE notes
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE producer_id = $3 AND instance_id = $4
                RETURNING *
            `, [newStatus, reason, producerId, instanceId]);

            if (updateResult.rows.length === 0) {
                throw new Error('Producer not found');
            }

            // If suspending, invalidate all sessions
            if (newStatus === 'suspended' || newStatus === 'inactive') {
                await client.query(
                    'DELETE FROM producer_sessions WHERE producer_id = $1',
                    [producerId]
                );
            }

            // Log status change
            await client.query(`
                INSERT INTO producer_audit_log (producer_id, action, details)
                VALUES ($1, $2, $3)
            `, [
                producerId, 
                `status_changed_to_${newStatus}`,
                JSON.stringify({ updatedBy, reason, previousStatus: updateResult.rows[0].status })
            ]);

            await client.query('COMMIT');

            return updateResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update producer LOB access
     */
    async updateProducerLOBAccess(producerId, instanceId, lobAccess) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verify producer belongs to instance
            const producerCheck = await client.query(
                'SELECT producer_id FROM producers WHERE producer_id = $1 AND instance_id = $2',
                [producerId, instanceId]
            );

            if (producerCheck.rows.length === 0) {
                throw new Error('Producer not found');
            }

            // Clear existing access
            await client.query(
                'DELETE FROM producer_lob_access WHERE producer_id = $1',
                [producerId]
            );

            // Add new access
            for (const access of lobAccess) {
                if (access.hasAccess) {
                    await client.query(`
                        INSERT INTO producer_lob_access 
                        (producer_id, lob_id, can_quote, can_bind, commission_rate)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        producerId,
                        access.lobId,
                        access.canQuote !== false,
                        access.canBind || false,
                        access.commissionRate || 0
                    ]);
                }
            }

            await client.query('COMMIT');

            return { success: true };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Create producer in IMS
     */
    async createProducerInIMS(producer) {
        try {
            // Get instance IMS credentials
            const instanceResult = await pool.query(
                'SELECT url, username, password FROM ims_instances WHERE instance_id = $1',
                [producer.instance_id]
            );

            if (instanceResult.rows.length === 0) {
                return null;
            }

            const imsCredentials = instanceResult.rows[0];

            // Create producer in IMS
            const producerData = {
                name: producer.agency_name,
                contactFirstName: producer.first_name,
                contactLastName: producer.last_name,
                email: producer.email,
                phone: producer.phone,
                address1: producer.address_line1,
                address2: producer.address_line2,
                city: producer.city,
                state: producer.state,
                zip: producer.zip
            };

            // This would call IMS AddProducer API
            // For now, return mock data
            console.log('Would create producer in IMS:', producerData);

            return {
                producerGuid: 'MOCK-' + producer.producer_id,
                contactGuid: 'MOCK-CONTACT-' + producer.producer_id,
                locationGuid: 'MOCK-LOCATION-' + producer.producer_id
            };

        } catch (error) {
            console.error('Error creating producer in IMS:', error);
            throw error;
        }
    }

    /**
     * Get producer activity log
     */
    async getProducerActivity(producerId, instanceId, days = 30) {
        const result = await pool.query(`
            SELECT 
                pal.*,
                p.first_name,
                p.last_name,
                p.agency_name
            FROM producer_audit_log pal
            JOIN producers p ON pal.producer_id = p.producer_id
            WHERE pal.producer_id = $1 
            AND p.instance_id = $2
            AND pal.created_at >= CURRENT_TIMESTAMP - ($3 || ' days')::INTERVAL
            ORDER BY pal.created_at DESC
        `, [producerId, instanceId, days]);

        return result.rows;
    }

    /**
     * Get producer statistics for dashboard
     */
    async getProducerStatistics(instanceId) {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_producers,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_producers,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_producers,
                COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_producers,
                COUNT(CASE WHEN last_login >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as active_last_30_days
            FROM producers
            WHERE instance_id = $1
        `, [instanceId]);

        return result.rows[0];
    }
}

module.exports = new ProducerManagementService();