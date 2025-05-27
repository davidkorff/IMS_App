const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('Loading routes...');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/instances', require('./routes/instances'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/email-filing', require('./routes/emailConfig'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/migration', require('./routes/migration'));
app.use('/auth/graph', require('./routes/graphAuth'));

// Load webui routes with error handling
console.log('Loading webui routes...');
try {
    const webuiRouter = require('./routes/webui');
    if (!webuiRouter) {
        console.error('webui router is undefined');
    } else {
        console.log('Webui router loaded successfully');
        app.use('/api/webui', webuiRouter);
        
        // Add submission routes
        app.use('/api/webui/submission/submission', require('./routes/webui/submission/submission'));
    }
} catch (error) {
    console.error('Error loading webui router:', error);
}

// HTML Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/instance/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'instance.html'));
});

// Add this route for forms
app.get('/instance/:id/forms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forms.html'));
});

// Add this route for company/line/state forms view
app.get('/instance/:id/forms/companylinestate', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forms-companylinestate.html'));
});

app.get('/instance/:id/reporting', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reporting.html'));
});

app.get('/instance/:id/webui', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'webui.html'));
});

app.get('/instance/:id/webui/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'webui-search.html'));
});

app.get('/instance/:id/webui/policy/:controlNo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'webui-policy.html'));
});

// Update the forms-all route to include query parameters
app.get('/instance/:id/forms/all', (req, res) => {
    // Pass along any query parameters that were included
    const queryString = Object.keys(req.query).length ? 
        '?' + new URLSearchParams(req.query).toString() : '';
    res.sendFile(path.join(__dirname, 'public', 'forms-all.html'));
});

// Add this route for new submission
app.get('/instance/:id/newsubmission', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'newsubmission.html'));
});

// Add this route for email filing
app.get('/instance/:id/email-filing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'email-filing-new.html'));
});

// Add this route for billing
app.get('/instance/:id/billing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'billing.html'));
});

// Add graph testing page
app.get('/graph-test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'graph-test.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start email processing automatically
    try {
        const emailProcessor = require('./services/emailProcessor');
        const intervalMinutes = 5; // Check every 5 minutes
        
        console.log('Starting automatic email processing...');
        emailProcessor.startProcessing(intervalMinutes);
        console.log(`✅ Email monitoring started - checking every ${intervalMinutes} minutes`);
    } catch (error) {
        console.error('❌ Failed to start email processing:', error.message);
    }
}); 