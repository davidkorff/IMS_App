const router = require('express').Router();
const pool = require('../config/db');
const usageTrackingService = require('../services/usageTrackingService');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get user's current subscription and usage
router.get('/subscription', async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const subscription = await usageTrackingService.getUserSubscription(userId);
        const currentUsage = await usageTrackingService.getCurrentUsage(userId);
        
        if (!subscription) {
            return res.json({
                success: true,
                subscription: null,
                usage: currentUsage,
                message: 'No active subscription'
            });
        }

        res.json({
            success: true,
            subscription,
            usage: currentUsage
        });

    } catch (error) {
        console.error('Error getting subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get available subscription plans
router.get('/plans', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM subscription_plans 
            WHERE is_active = true 
            ORDER BY monthly_price ASC
        `);

        res.json({
            success: true,
            plans: result.rows
        });

    } catch (error) {
        console.error('Error getting plans:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Subscribe to a plan (or change plan)
router.post('/subscribe', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { planId } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'Plan ID is required'
            });
        }

        // Verify plan exists
        const planResult = await pool.query(
            'SELECT * FROM subscription_plans WHERE plan_id = $1 AND is_active = true',
            [planId]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        const plan = planResult.rows[0];

        // Calculate billing period (monthly billing)
        const currentDate = new Date();
        const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Check if user has existing subscription
        const existingResult = await pool.query(
            'SELECT * FROM user_subscriptions WHERE user_id = $1 AND status = $2',
            [userId, 'active']
        );

        if (existingResult.rows.length > 0) {
            // Update existing subscription
            await pool.query(`
                UPDATE user_subscriptions 
                SET plan_id = $1, current_period_start = $2, current_period_end = $3, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $4 AND status = $5
            `, [planId, periodStart, periodEnd, userId, 'active']);
        } else {
            // Create new subscription
            await pool.query(`
                INSERT INTO user_subscriptions (user_id, plan_id, current_period_start, current_period_end, status)
                VALUES ($1, $2, $3, $4, $5)
            `, [userId, planId, periodStart, periodEnd, 'active']);
        }

        // Initialize user quotas for the new plan
        await usageTrackingService.initializeUserQuotas(userId, planId);

        res.json({
            success: true,
            message: `Subscribed to ${plan.plan_display_name}`,
            plan: plan
        });

    } catch (error) {
        console.error('Error subscribing to plan:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get usage summary for current month
router.get('/usage', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { month, year } = req.query;

        let startDate, endDate;
        
        if (month && year) {
            startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            endDate = new Date(parseInt(year), parseInt(month), 0);
        } else {
            // Current month
            startDate = new Date();
            startDate.setDate(1);
            endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
        }

        const usage = await usageTrackingService.getUsageSummary(userId, startDate, endDate);
        const billing = await usageTrackingService.calculateMonthlyBill(userId, startDate);

        res.json({
            success: true,
            period: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            },
            usage,
            billing
        });

    } catch (error) {
        console.error('Error getting usage:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get detailed usage events (for debugging/support)
router.get('/usage/events', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { limit = 50, offset = 0, event_type } = req.query;

        let query = `
            SELECT 
                ue.*,
                ii.name as instance_name
            FROM usage_events ue
            LEFT JOIN ims_instances ii ON ue.instance_id = ii.instance_id
            WHERE ue.user_id = $1
        `;
        
        let params = [userId];
        let paramIndex = 2;

        if (event_type) {
            query += ` AND ue.event_type = $${paramIndex}`;
            params.push(event_type);
            paramIndex++;
        }

        query += ` ORDER BY ue.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        res.json({
            success: true,
            events: result.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rowCount
            }
        });

    } catch (error) {
        console.error('Error getting usage events:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Check if user can perform an action (quota check)
router.get('/quota/:action', async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { action } = req.params;

        const quotaCheck = await usageTrackingService.checkQuotaLimit(userId, action);
        
        res.json({
            success: true,
            allowed: quotaCheck.allowed,
            reason: quotaCheck.reason,
            current: quotaCheck.current,
            limit: quotaCheck.limit
        });

    } catch (error) {
        console.error('Error checking quota:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get billing history/invoices
router.get('/invoices', async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const result = await pool.query(`
            SELECT 
                invoice_id,
                invoice_number,
                billing_period_start,
                billing_period_end,
                subtotal,
                tax_amount,
                total_amount,
                status,
                due_date,
                paid_at,
                created_at
            FROM billing_invoices 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);

        res.json({
            success: true,
            invoices: result.rows
        });

    } catch (error) {
        console.error('Error getting invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Admin endpoint to get all users and their usage (protect this properly in production)
router.get('/admin/users', async (req, res) => {
    try {
        // In production, add proper admin authentication here
        const result = await pool.query(`
            SELECT 
                u.user_id,
                u.email,
                u.created_at as user_created,
                sp.plan_display_name,
                sp.monthly_price,
                us.status as subscription_status,
                us.current_period_start,
                us.current_period_end,
                COUNT(DISTINCT ii.instance_id) as instance_count,
                COUNT(CASE WHEN ue.event_type = 'email_filed' AND ue.created_at >= us.current_period_start THEN 1 END) as emails_this_period
            FROM users u
            LEFT JOIN user_subscriptions us ON u.user_id = us.user_id AND us.status = 'active'
            LEFT JOIN subscription_plans sp ON us.plan_id = sp.plan_id
            LEFT JOIN ims_instances ii ON u.user_id = ii.user_id
            LEFT JOIN usage_events ue ON u.user_id = ue.user_id
            GROUP BY u.user_id, u.email, u.created_at, sp.plan_display_name, sp.monthly_price, 
                     us.status, us.current_period_start, us.current_period_end
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {
        console.error('Error getting admin users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Start a free trial
router.post('/trial/start', async (req, res) => {
    try {
        const userId = req.user.user_id;

        // Check if user already had a trial
        const existingTrial = await pool.query(
            'SELECT * FROM user_subscriptions WHERE user_id = $1 AND trial_ends_at IS NOT NULL',
            [userId]
        );

        if (existingTrial.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Trial already used'
            });
        }

        // Get starter plan (or create trial plan)
        const starterPlan = await pool.query(
            'SELECT * FROM subscription_plans WHERE plan_name = $1',
            ['starter']
        );

        if (starterPlan.rows.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'Starter plan not found'
            });
        }

        const plan = starterPlan.rows[0];
        const currentDate = new Date();
        const trialEnd = new Date(currentDate);
        trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial

        const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Create trial subscription
        await pool.query(`
            INSERT INTO user_subscriptions 
            (user_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, plan.plan_id, 'trial', trialEnd, periodStart, periodEnd]);

        // Initialize quotas
        await usageTrackingService.initializeUserQuotas(userId, plan.plan_id);

        res.json({
            success: true,
            message: '14-day free trial started',
            trial_ends: trialEnd.toISOString(),
            plan: plan
        });

    } catch (error) {
        console.error('Error starting trial:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;