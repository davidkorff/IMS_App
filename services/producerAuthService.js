const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

class ProducerAuthService {
    constructor() {
        this.tokenExpiry = '24h';
        this.sessionExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    }

    /**
     * Register a new producer
     */
    async register(instanceId, producerData) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if email already exists for this instance
            const existingCheck = await client.query(
                'SELECT producer_id FROM producers WHERE email = $1 AND instance_id = $2',
                [producerData.email, instanceId]
            );

            if (existingCheck.rows.length > 0) {
                throw new Error('Email already registered for this portal');
            }

            // Hash password
            const passwordHash = await bcrypt.hash(producerData.password, 10);

            // Generate email verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Insert producer (with email_verified set to true by default)
            const insertResult = await client.query(`
                INSERT INTO producers (
                    instance_id, email, password_hash, first_name, last_name,
                    agency_name, phone, address_line1, address_line2,
                    city, state, zip, email_verification_token,
                    email_verification_expires, email_verified, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, 'pending')
                RETURNING producer_id, email, first_name, last_name, agency_name
            `, [
                instanceId, producerData.email, passwordHash,
                producerData.firstName, producerData.lastName,
                producerData.agencyName, producerData.phone,
                producerData.address1, producerData.address2,
                producerData.city, producerData.state, producerData.zip,
                verificationToken, verificationExpires
            ]);

            const producer = insertResult.rows[0];

            // Log registration
            await this.logAction(client, producer.producer_id, 'register', {
                email: producer.email,
                agency: producer.agency_name
            });

            await client.query('COMMIT');

            return {
                producerId: producer.producer_id,
                email: producer.email,
                verificationToken: verificationToken,
                producer: producer
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Verify email address
     */
    async verifyEmail(token) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE producers 
                SET email_verified = true,
                    email_verification_token = NULL,
                    email_verification_expires = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email_verification_token = $1 
                AND email_verification_expires > CURRENT_TIMESTAMP
                AND email_verified = false
                RETURNING producer_id, email, instance_id
            `, [token]);

            if (result.rows.length === 0) {
                throw new Error('Invalid or expired verification token');
            }

            const producer = result.rows[0];

            await this.logAction(client, producer.producer_id, 'email_verified', {
                email: producer.email
            });

            await client.query('COMMIT');

            return producer;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Login producer
     */
    async login(instanceId, email, password, ipAddress, userAgent) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get producer
            const result = await client.query(`
                SELECT p.*, ppc.portal_name
                FROM producers p
                JOIN producer_portal_config ppc ON p.instance_id = ppc.instance_id
                WHERE p.email = $1 AND p.instance_id = $2
            `, [email, instanceId]);

            if (result.rows.length === 0) {
                throw new Error('Invalid credentials');
            }

            const producer = result.rows[0];

            // Check password
            const validPassword = await bcrypt.compare(password, producer.password_hash);
            if (!validPassword) {
                throw new Error('Invalid credentials');
            }

            // Check if email is verified
            if (!producer.email_verified) {
                throw new Error('Please verify your email address first');
            }

            // Check if producer is approved
            if (producer.status !== 'approved') {
                throw new Error(`Account is ${producer.status}. Please contact administrator.`);
            }

            // Generate JWT token
            const jwtToken = jwt.sign(
                {
                    producerId: producer.producer_id,
                    instanceId: producer.instance_id,
                    email: producer.email,
                    type: 'producer'
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: this.tokenExpiry }
            );

            // Create session
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + this.sessionExpiry);

            await client.query(`
                INSERT INTO producer_sessions (producer_id, token, ip_address, user_agent, expires_at)
                VALUES ($1, $2, $3, $4, $5)
            `, [producer.producer_id, sessionToken, ipAddress, userAgent, expiresAt]);

            // Update last login
            await client.query(
                'UPDATE producers SET last_login = CURRENT_TIMESTAMP WHERE producer_id = $1',
                [producer.producer_id]
            );

            // Log login
            await this.logAction(client, producer.producer_id, 'login', {
                ip: ipAddress,
                userAgent: userAgent
            }, ipAddress, userAgent);

            await client.query('COMMIT');

            return {
                token: jwtToken,
                sessionToken: sessionToken,
                producer: {
                    id: producer.producer_id,
                    email: producer.email,
                    firstName: producer.first_name,
                    lastName: producer.last_name,
                    agencyName: producer.agency_name,
                    status: producer.status,
                    portalName: producer.portal_name
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Logout producer
     */
    async logout(sessionToken) {
        await pool.query(
            'DELETE FROM producer_sessions WHERE token = $1',
            [sessionToken]
        );
    }

    /**
     * Validate session
     */
    async validateSession(sessionToken) {
        const result = await pool.query(`
            SELECT ps.*, p.email, p.first_name, p.last_name, p.agency_name, p.status
            FROM producer_sessions ps
            JOIN producers p ON ps.producer_id = p.producer_id
            WHERE ps.token = $1 AND ps.expires_at > CURRENT_TIMESTAMP
        `, [sessionToken]);

        if (result.rows.length === 0) {
            return null;
        }

        const session = result.rows[0];

        // Check if producer is still active
        if (session.status !== 'approved') {
            await pool.query('DELETE FROM producer_sessions WHERE token = $1', [sessionToken]);
            return null;
        }

        return {
            producerId: session.producer_id,
            email: session.email,
            firstName: session.first_name,
            lastName: session.last_name,
            agencyName: session.agency_name
        };
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(instanceId, email) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            const result = await client.query(`
                UPDATE producers 
                SET password_reset_token = $1,
                    password_reset_expires = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = $3 AND instance_id = $4
                RETURNING producer_id, email, first_name
            `, [resetToken, resetExpires, email, instanceId]);

            if (result.rows.length === 0) {
                // Don't reveal if email exists or not
                return { success: true };
            }

            const producer = result.rows[0];

            await this.logAction(client, producer.producer_id, 'password_reset_requested', {
                email: producer.email
            });

            await client.query('COMMIT');

            return {
                success: true,
                resetToken: resetToken,
                email: producer.email,
                firstName: producer.first_name
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Reset password
     */
    async resetPassword(token, newPassword) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const passwordHash = await bcrypt.hash(newPassword, 10);

            const result = await client.query(`
                UPDATE producers 
                SET password_hash = $1,
                    password_reset_token = NULL,
                    password_reset_expires = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE password_reset_token = $2 
                AND password_reset_expires > CURRENT_TIMESTAMP
                RETURNING producer_id, email
            `, [passwordHash, token]);

            if (result.rows.length === 0) {
                throw new Error('Invalid or expired reset token');
            }

            const producer = result.rows[0];

            // Invalidate all existing sessions
            await client.query(
                'DELETE FROM producer_sessions WHERE producer_id = $1',
                [producer.producer_id]
            );

            await this.logAction(client, producer.producer_id, 'password_reset', {
                email: producer.email
            });

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
     * Clean up expired sessions
     */
    async cleanupSessions() {
        await pool.query(
            'DELETE FROM producer_sessions WHERE expires_at < CURRENT_TIMESTAMP'
        );
    }

    /**
     * Log producer action
     */
    async logAction(client, producerId, action, details, ipAddress = null, userAgent = null) {
        await client.query(`
            INSERT INTO producer_audit_log (producer_id, action, details, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            producerId,
            action,
            JSON.stringify(details),
            ipAddress,
            userAgent
        ]);
    }
}

module.exports = new ProducerAuthService();