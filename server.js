const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Subdomain routing for producer portals (if needed)
const subdomainRouter = require('./middleware/subdomainRouter');
app.use(subdomainRouter);

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

// Form builder routes
try {
    console.log('Loading form builder routes...');
    app.use('/api/forms', require('./routes/formBuilder'));
    console.log('✅ Form builder routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading form builder routes:', error);
}

// Form builder context routes (secure state management)
try {
    console.log('Loading form builder context routes...');
    app.use('/api/form-builder-context', require('./routes/formBuilderContext'));
    console.log('✅ Form builder context routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading form builder context routes:', error);
}

// Add system settings routes directly
try {
    console.log('Loading system settings routes directly...');
    app.use('/api/system-settings', require('./routes/webui/systemSettings'));
    console.log('✅ System settings routes loaded at /api/system-settings');
} catch (error) {
    console.error('❌ Error loading system settings routes:', error);
}

console.log('Loading custom routes...');
try {
    const customRoutesRouter = require('./routes/customRoutes');
    app.use('/api/custom-routes', customRoutesRouter);
    console.log('✅ Custom routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading custom routes:', error);
}

// Load producer portal routes
console.log('Loading producer portal routes...');
try {
    const producerRouter = require('./routes/producer');
    const producerAdminRouter = require('./routes/producerAdmin');
    
    // Producer routes (public and authenticated)
    app.use('/api/producer', producerRouter);
    console.log('✅ Producer routes loaded at /api/producer');
    
    // Producer admin routes (requires MGA admin auth)
    app.use('/api/producer-admin', producerAdminRouter);
    console.log('✅ Producer admin routes loaded at /api/producer-admin');
} catch (error) {
    console.error('❌ Error loading producer portal routes:', error);
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

// Producer Portal Direct Access (for testing without subdomain)
app.get('/producer-portal/:instanceId?', async (req, res) => {
    const instanceId = req.params.instanceId || req.query.instance;
    if (instanceId) {
        // Store instance ID in session or pass to login page
        res.redirect(`/producer-login?instance=${instanceId}`);
    } else {
        res.send('Please specify an instance ID');
    }
});

// Producer Portal Routes
app.get('/producer-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-login.html'));
});

app.get('/producer-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-register.html'));
});

app.get('/producer-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-dashboard.html'));
});

app.get('/producer-submissions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-submissions.html'));
});

app.get('/producer-submission/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-submission-detail.html'));
});

app.get('/producer-new-submission/:lobId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-new-submission-enhanced.html'));
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

// Add system settings route
app.get('/instance/:id/system-settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'system-settings.html'));
});

// Producer admin route
app.get('/instance/:id/producer-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-admin.html'));
});

// Form builder route
app.get('/form-builder.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'form-builder.html'));
});

// Instance-specific producer portal routes
app.get('/instance/:id/producer-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-register.html'));
});

app.get('/instance/:id/producer-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-login.html'));
});

// Producer portal routes
app.get('/producer-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-login.html'));
});

app.get('/producer-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-register.html'));
});

app.get('/producer-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-dashboard.html'));
});

app.get('/producer-submission/new', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-submission.html'));
});

app.get('/producer-submission/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-submission-detail.html'));
});

app.get('/producer-submissions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-submissions.html'));
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

// Producer Portal Routes
app.get('/producer/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-login.html'));
});

app.get('/producer/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-register.html'));
});

app.get('/producer/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-dashboard.html'));
});

app.get('/producer/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-forgot-password.html'));
});

app.get('/producer/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-reset-password.html'));
});

app.get('/producer/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-profile.html'));
});

app.get('/producer/submissions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-submissions.html'));
});

app.get('/producer/submissions/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-submission-detail.html'));
});

app.get('/producer/new-submission/:lobId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'producer-new-submission-enhanced.html'));
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