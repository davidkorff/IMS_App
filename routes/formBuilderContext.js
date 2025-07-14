const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// In-memory storage for form builder context (in production, use Redis or session storage)
const formBuilderContexts = new Map();

// Store form builder context
router.post('/context', auth, (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const { lobId, instanceId, formSchemaId } = req.body;
        
        // Create a secure context ID
        const contextId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store context with expiration (30 minutes)
        formBuilderContexts.set(contextId, {
            userId,
            lobId,
            instanceId,
            formSchemaId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        });
        
        // Clean up expired contexts
        cleanupExpiredContexts();
        
        res.json({ contextId });
    } catch (error) {
        console.error('Error storing form builder context:', error);
        res.status(500).json({ error: 'Failed to store context' });
    }
});

// Retrieve form builder context
router.get('/context/:contextId', auth, (req, res) => {
    try {
        const { contextId } = req.params;
        const userId = req.user.user_id || req.user.userId;
        
        const context = formBuilderContexts.get(contextId);
        
        if (!context) {
            return res.status(404).json({ error: 'Context not found' });
        }
        
        // Verify the context belongs to the current user
        if (context.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Check if context has expired
        if (new Date() > context.expiresAt) {
            formBuilderContexts.delete(contextId);
            return res.status(410).json({ error: 'Context expired' });
        }
        
        res.json({
            lobId: context.lobId,
            instanceId: context.instanceId,
            formSchemaId: context.formSchemaId
        });
        
        // Delete context after retrieval (one-time use)
        formBuilderContexts.delete(contextId);
    } catch (error) {
        console.error('Error retrieving form builder context:', error);
        res.status(500).json({ error: 'Failed to retrieve context' });
    }
});

// Cleanup expired contexts
function cleanupExpiredContexts() {
    const now = new Date();
    for (const [contextId, context] of formBuilderContexts.entries()) {
        if (now > context.expiresAt) {
            formBuilderContexts.delete(contextId);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredContexts, 5 * 60 * 1000);

module.exports = router;