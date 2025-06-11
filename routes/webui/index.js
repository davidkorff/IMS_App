console.log('Loading main webui router - START');

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Import forms router
try {
    console.log('Attempting to load forms router...');
    const formsRouter = require('./forms');
    console.log('Forms router loaded successfully');
    router.use('/forms', formsRouter);
} catch (error) {
    console.error('Error loading forms router:', error.stack);
}

// Import submission router with file system check
try {
    const submissionPath = path.join(__dirname, 'submission', 'index.js');
    console.log('Looking for submission router at:', submissionPath);
    
    if (fs.existsSync(submissionPath)) {
        console.log('Found submission router file');
        const submissionRouter = require(submissionPath);
        console.log('Submission router loaded successfully');
        router.use('/submission', submissionRouter);
        console.log('Submission routes added successfully');
    } else {
        console.error('Submission router file not found at:', submissionPath);
    }
} catch (error) {
    console.error('Error loading submission router:', error.stack);
    console.error('Full error:', error);
}

// Import system settings router
try {
    console.log('Attempting to load system settings router...');
    const systemSettingsRouter = require('./systemSettings');
    console.log('System settings router loaded successfully');
    router.use('/system', systemSettingsRouter);
    console.log('System settings router mounted at /system');
} catch (error) {
    console.error('Error loading system settings router:', error.stack);
}

// ... other webui routes ...

console.log('Loading main webui router - END');

module.exports = router; 