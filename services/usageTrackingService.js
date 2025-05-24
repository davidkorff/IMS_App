const pool = require('../config/db');

class UsageTrackingService {
    constructor() {
        this.eventTypes = {
            EMAIL_PROCESSED: 'email_processed',
            EMAIL_FILED: 'email_filed', 
            WEBHOOK_CALL: 'webhook_call',
            API_CALL: 'api_call',
            MANUAL_FILING: 'manual_filing',
            IMS_AUTH: 'ims_auth'
        };

        this.eventSubtypes = {
            SUCCESS: 'success',
            FAILURE: 'failure',
            MANUAL: 'manual',
            AUTOMATED: 'automated'
        };
    }

    async recordUsageEvent(userId, instanceId, eventType, eventSubtype = null, quantity = 1, metadata = {}) {
        try {
            console.log(`Recording usage event: ${eventType} for user ${userId}`);
            
            const result = await pool.query(
                'SELECT record_usage_event($1, $2, $3, $4, $5, $6) as event_id',
                [userId, instanceId, eventType, eventSubtype, quantity, JSON.stringify(metadata)]
            );

            const eventId = result.rows[0].event_id;
            console.log(`Usage event recorded with ID: ${eventId}`);
            
            return eventId;
        } catch (error) {
            console.error('Error recording usage event:', error);
            // Don't throw - usage tracking shouldn't break main functionality
            return null;
        }
    }

    async trackEmailProcessed(userId, instanceId, success = true, metadata = {}) {
        const subtype = success ? this.eventSubtypes.SUCCESS : this.eventSubtypes.FAILURE;
        return this.recordUsageEvent(
            userId, 
            instanceId, 
            this.eventTypes.EMAIL_PROCESSED, 
            subtype, 
            1, 
            metadata
        );
    }

    async trackEmailFiled(userId, instanceId, controlNumber, documentGuid, metadata = {}) {
        return this.recordUsageEvent(
            userId, 
            instanceId, 
            this.eventTypes.EMAIL_FILED, 
            this.eventSubtypes.SUCCESS, 
            1, 
            { controlNumber, documentGuid, ...metadata }
        );
    }

    async trackWebhookCall(userId, configId, success = true, metadata = {}) {
        const subtype = success ? this.eventSubtypes.SUCCESS : this.eventSubtypes.FAILURE;
        return this.recordUsageEvent(
            userId, 
            null, 
            this.eventTypes.WEBHOOK_CALL, 
            subtype, 
            1, 
            { configId, ...metadata }
        );
    }

    async trackManualFiling(userId, instanceId, success = true, metadata = {}) {
        const subtype = success ? this.eventSubtypes.SUCCESS : this.eventSubtypes.FAILURE;
        return this.recordUsageEvent(
            userId, 
            instanceId, 
            this.eventTypes.MANUAL_FILING, 
            subtype, 
            1, 
            metadata
        );
    }

    async trackIMSAuthentication(userId, instanceId, success = true) {
        const subtype = success ? this.eventSubtypes.SUCCESS : this.eventSubtypes.FAILURE;
        return this.recordUsageEvent(
            userId, 
            instanceId, 
            this.eventTypes.IMS_AUTH, 
            subtype, 
            1, 
            {}
        );
    }

    async getCurrentUsage(userId, eventType = null) {
        try {
            let query = `
                SELECT 
                    quota_type,
                    quota_limit,
                    current_usage,
                    current_period_start,
                    current_period_end,
                    CASE 
                        WHEN quota_limit IS NULL THEN false
                        WHEN current_usage >= quota_limit THEN true
                        ELSE false
                    END as is_over_limit
                FROM user_quotas 
                WHERE user_id = $1 
                  AND current_period_end >= CURRENT_DATE
            `;
            
            let params = [userId];
            
            if (eventType) {
                query += ' AND quota_type = $2';
                params.push(eventType);
            }
            
            query += ' ORDER BY quota_type';
            
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error getting current usage:', error);
            return [];
        }
    }

    async checkQuotaLimit(userId, eventType) {
        try {
            const result = await pool.query(`
                SELECT 
                    uq.quota_limit,
                    uq.current_usage,
                    sp.monthly_email_limit,
                    sp.max_instances,
                    CASE 
                        WHEN uq.quota_limit IS NULL THEN false
                        WHEN uq.current_usage >= uq.quota_limit THEN true
                        ELSE false
                    END as is_over_limit
                FROM user_quotas uq
                LEFT JOIN user_subscriptions us ON uq.user_id = us.user_id AND us.status = 'active'
                LEFT JOIN subscription_plans sp ON us.plan_id = sp.plan_id
                WHERE uq.user_id = $1 
                  AND uq.quota_type = $2
                  AND uq.current_period_end >= CURRENT_DATE
                ORDER BY uq.last_reset_at DESC
                LIMIT 1
            `, [userId, eventType]);

            if (result.rows.length === 0) {
                return { allowed: true, reason: 'No quota found' };
            }

            const quota = result.rows[0];
            
            if (quota.is_over_limit) {
                return { 
                    allowed: false, 
                    reason: `Quota exceeded: ${quota.current_usage}/${quota.quota_limit}`,
                    current: quota.current_usage,
                    limit: quota.quota_limit
                };
            }

            return { 
                allowed: true, 
                current: quota.current_usage,
                limit: quota.quota_limit
            };
        } catch (error) {
            console.error('Error checking quota limit:', error);
            return { allowed: true, reason: 'Error checking quota' };
        }
    }

    async getUserSubscription(userId) {
        try {
            const result = await pool.query(`
                SELECT 
                    us.*,
                    sp.plan_name,
                    sp.plan_display_name,
                    sp.monthly_price,
                    sp.max_instances,
                    sp.monthly_email_limit,
                    sp.overage_price_per_email,
                    sp.features
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.plan_id
                WHERE us.user_id = $1 
                  AND us.status = 'active'
                ORDER BY us.created_at DESC
                LIMIT 1
            `, [userId]);

            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting user subscription:', error);
            return null;
        }
    }

    async getUsageSummary(userId, startDate = null, endDate = null) {
        try {
            // Default to current month if no dates provided
            if (!startDate) {
                startDate = new Date();
                startDate.setDate(1); // First day of current month
            }
            if (!endDate) {
                endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(0); // Last day of current month
            }

            const result = await pool.query(`
                SELECT 
                    event_type,
                    event_subtype,
                    COUNT(*) as event_count,
                    SUM(quantity) as total_quantity,
                    COUNT(DISTINCT DATE(created_at)) as active_days
                FROM usage_events 
                WHERE user_id = $1 
                  AND created_at >= $2 
                  AND created_at <= $3
                  AND billable = true
                GROUP BY event_type, event_subtype
                ORDER BY event_type, event_subtype
            `, [userId, startDate, endDate]);

            return result.rows;
        } catch (error) {
            console.error('Error getting usage summary:', error);
            return [];
        }
    }

    async calculateMonthlyBill(userId, billingMonth = null) {
        try {
            if (!billingMonth) {
                billingMonth = new Date();
                billingMonth.setDate(1); // First day of current month
            }

            // Get user's subscription
            const subscription = await this.getUserSubscription(userId);
            if (!subscription) {
                return { error: 'No active subscription found' };
            }

            // Get usage for the month
            const startDate = new Date(billingMonth);
            const endDate = new Date(billingMonth);
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);

            const usage = await this.getUsageSummary(userId, startDate, endDate);
            
            // Calculate billing
            const emailsProcessed = usage.find(u => u.event_type === this.eventTypes.EMAIL_FILED)?.total_quantity || 0;
            const includedEmails = subscription.monthly_email_limit;
            const overageEmails = Math.max(0, emailsProcessed - includedEmails);
            
            const baseCharge = subscription.monthly_price;
            const overageCharge = overageEmails * subscription.overage_price_per_email;
            const totalCharge = parseFloat(baseCharge) + overageCharge;

            return {
                billing_month: billingMonth,
                plan_name: subscription.plan_display_name,
                base_charge: baseCharge,
                included_emails: includedEmails,
                emails_processed: emailsProcessed,
                overage_emails: overageEmails,
                overage_rate: subscription.overage_price_per_email,
                overage_charge: overageCharge,
                total_charge: totalCharge,
                usage_details: usage
            };
        } catch (error) {
            console.error('Error calculating monthly bill:', error);
            return { error: error.message };
        }
    }

    async initializeUserQuotas(userId, planId) {
        try {
            // Get plan details
            const planResult = await pool.query(
                'SELECT * FROM subscription_plans WHERE plan_id = $1',
                [planId]
            );

            if (planResult.rows.length === 0) {
                throw new Error('Plan not found');
            }

            const plan = planResult.rows[0];
            const currentDate = new Date();
            const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            // Initialize email quota
            if (plan.monthly_email_limit) {
                await pool.query(`
                    INSERT INTO user_quotas (user_id, quota_type, current_period_start, current_period_end, quota_limit)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (user_id, quota_type, current_period_start) 
                    DO UPDATE SET quota_limit = $5
                `, [userId, this.eventTypes.EMAIL_FILED, periodStart, periodEnd, plan.monthly_email_limit]);
            }

            // Initialize instance quota
            if (plan.max_instances) {
                await pool.query(`
                    INSERT INTO user_quotas (user_id, quota_type, current_period_start, current_period_end, quota_limit)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (user_id, quota_type, current_period_start) 
                    DO UPDATE SET quota_limit = $5
                `, [userId, 'instances', periodStart, periodEnd, plan.max_instances]);
            }

            console.log(`Initialized quotas for user ${userId} on plan ${plan.plan_name}`);
        } catch (error) {
            console.error('Error initializing user quotas:', error);
            throw error;
        }
    }
}

module.exports = new UsageTrackingService();