// Script to restart email processing with the new V2 processor
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'https://ims-application.onrender.com';

async function restartEmailProcessing() {
    try {
        console.log('🛑 Stopping email processing...');
        
        // Stop current processing
        const stopResponse = await fetch(`${API_BASE}/api/email-filing/stop-processing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const stopResult = await stopResponse.json();
        console.log('Stop result:', stopResult);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('🚀 Starting email processing with V2...');
        
        // Start processing again (now using EmailProcessorV2)
        const startResponse = await fetch(`${API_BASE}/api/email-filing/start-processing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                intervalMinutes: 5
            })
        });
        
        const startResult = await startResponse.json();
        console.log('Start result:', startResult);
        
        console.log('✅ Email processing restarted with plus addressing support!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

restartEmailProcessing();