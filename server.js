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
app.use('/api/custom-webhooks', require('./routes/customWebhooks'));

console.log('Loading custom routes...');
try {
    const customRoutesRouter = require('./routes/customRoutes');
    app.use('/api/custom-routes', customRoutesRouter);
    console.log('✅ Custom routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading custom routes:', error);
}

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

app.get('/login', (req, res) => {
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

app.get('/instance/:id/newsubmission', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'newsubmission.html'));
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

// Email filing routes
app.get('/instance/:id/email-filing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'email-filing-list.html'));
});

app.get('/instance/:id/email-filing/new', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'email-filing-new.html'));
});

app.get('/instance/:id/email-filing/:configId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'email-filing-detail.html'));
});

// Add this route for billing
app.get('/instance/:id/billing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'billing.html'));
});

// Custom webhooks route
app.get('/instance/:id/webhooks', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'webhooks.html'));
});

// Add route for forms page
app.get('/instance/:id/forms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forms.html'));
});

// Add graph testing page
app.get('/graph-test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'graph-test.html'));
});

// Custom Routes pages - specific routes first, then dynamic ones
app.get('/instance/:id/custom-routes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'custom-routes.html'));
});

// Instructions page - must come before :routeId route
app.get('/instance/:id/custom-routes/instructions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'custom-routes-instructions.html'));
});

app.get('/instance/:id/custom-routes/new', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'custom-routes-builder.html'));
});

app.get('/instance/:id/custom-routes/:routeId/submissions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'custom-routes-submissions.html'));
});

// Dynamic route - must come last
app.get('/instance/:id/custom-routes/:routeId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'custom-routes-builder.html'));
});

// Public form routes (no authentication)
app.get('/form/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'custom-routes-public-form.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Initialize email configuration schema
    try {
        const emailConfigService = require('./services/emailConfigService');
        await emailConfigService.initializeSchema();
    } catch (error) {
        console.error('❌ Failed to initialize email configuration schema:', error.message);
    }
    
    // Start catch-all email processing automatically  
    try {
        const catchAllEmailProcessor = require('./services/catchAllEmailProcessor');
        const intervalMinutes = 5; // Check every 5 minutes
        
        console.log('Starting automatic catch-all email processing...');
        catchAllEmailProcessor.startProcessing(intervalMinutes);
        console.log(`✅ Catch-all email monitoring started - checking every ${intervalMinutes} minutes`);
        console.log(`📨 Processing emails from catch-all inbox: documents@42consultingllc.com`);
    } catch (error) {
        console.error('❌ Failed to start catch-all email processing:', error.message);
    }
}); 