const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('🚀 Starting Producer Portal Server...');

// Producer API Routes
app.use('/api/producer', require('./routes/producer'));

// Producer Portal Pages
app.get('/', (req, res) => {
    res.redirect('/producer/login');
});

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
    res.sendFile(path.join(__dirname, 'public', 'producer-new-submission.html'));
});

// Serve states.js
app.get('/js/states.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'states.js'));
});

const PORT = 5001;
app.listen(PORT, async () => {
    console.log(`✅ Producer Portal running on http://localhost:${PORT}`);
    console.log(`📍 Login at: http://localhost:${PORT}/producer/login`);
    console.log(`📝 Register at: http://localhost:${PORT}/producer/register`);
    console.log('\n💡 This is a test instance - in production, producers would access via subdomain.42ims.com');
});