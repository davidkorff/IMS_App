console.log('Loading submission router - START');

const express = require('express');
const router = express.Router();

// Add a test endpoint
router.get('/test', (req, res) => {
    res.json({ message: 'Submission router is working' });
});

// Import specific submission endpoints
try {
    console.log('Loading clearance router...');
    const clearanceRouter = require('./clearance');
    router.use('/clearance', clearanceRouter);
    console.log('Clearance router loaded successfully');

    console.log('Loading insured router...');
    const insuredRouter = require('./insured');
    router.use('/insured', insuredRouter);
    console.log('Insured router loaded successfully');
} catch (error) {
    console.error('Error loading routers:', error);
}

console.log('Loading submission router - END');

module.exports = router; 