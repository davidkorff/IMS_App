const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/instances', require('./routes/instances'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/webui', require('./routes/webui')); // Changed to /api/webui

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 