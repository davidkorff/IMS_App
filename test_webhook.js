#!/usr/bin/env node

/**
 * Local test script for debugging the email filing webhook
 * This simulates the exact webhook request from Zapier
 */

const emailFilingService = require('./services/emailFilingService');

// Simulated webhook data from the logs
const mockWebhookData = {
  "body_html": "<html><head>\r\n<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\"><meta content=\"text/html; charset=utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><meta name=\"x-apple-disable-message-reformatting\">...[truncated for brevity]",
  "body_text": "Your one-time code is: 193902.",
  "date": "2025-05-24T04:16:41Z",
  "from": "GoDaddy",
  "message_id": "<sqVG.11221.10230524.22056152.1748060195.6344652.2UZ@ip-10-123-28-31.us-west-2.compute.internal.mail>",
  "subject": "10000 Security Alert: Your one-time sign in code is 193902.",
  "to": "documents@42consultingllc.com"
};

async function testEmailFiling() {
    try {
        console.log('=== STARTING LOCAL EMAIL FILING TEST ===');
        console.log('Subject:', mockWebhookData.subject);
        console.log('Control number expected: 10000');
        
        // Test the email filing process
        const result = await emailFilingService.processIncomingEmail(1, mockWebhookData);
        
        console.log('=== TEST RESULT ===');
        console.log('Success:', result.success);
        console.log('Message:', result.message);
        if (result.controlNumber) {
            console.log('Control Number:', result.controlNumber);
        }
        if (result.documentGuid) {
            console.log('Document GUID:', result.documentGuid);
        }
        
    } catch (error) {
        console.error('=== TEST FAILED ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

async function testControlInformationDirectly() {
    try {
        console.log('\n=== TESTING GetControlInformation DIRECTLY ===');
        
        // Get the config
        const config = await emailFilingService.getConfigById(1);
        if (!config) {
            throw new Error('Config not found');
        }
        
        // Get instance
        const instance = await emailFilingService.getInstanceById(config.instance_id);
        if (!instance) {
            throw new Error('Instance not found');
        }
        
        // Get auth token
        const authService = require('./services/authService');
        const token = await authService.getToken(
            instance.url,
            instance.username,
            instance.password
        );
        
        console.log('Token received:', token);
        
        // Test GetControlInformation directly
        const controlInfo = await emailFilingService.getControlInformation(instance, token, '10000');
        console.log('Control Info Result:', controlInfo);
        
    } catch (error) {
        console.error('=== DIRECT TEST FAILED ===');
        console.error('Error:', error.message);
    }
}

async function testAlternativeControlNumbers() {
    try {
        console.log('\n=== TESTING ALTERNATIVE CONTROL NUMBERS ===');
        
        // Get the config
        const config = await emailFilingService.getConfigById(1);
        const instance = await emailFilingService.getInstanceById(config.instance_id);
        const authService = require('./services/authService');
        const token = await authService.getToken(instance.url, instance.username, instance.password);
        
        // Test different control numbers
        const testNumbers = ['10000', '1', '100', '999', '12345'];
        
        for (const controlNumber of testNumbers) {
            console.log(`\n--- Testing control number: ${controlNumber} ---`);
            try {
                const controlInfo = await emailFilingService.getControlInformation(instance, token, controlNumber);
                console.log(`✅ Success for ${controlNumber}:`, controlInfo);
            } catch (error) {
                console.log(`❌ Failed for ${controlNumber}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('=== ALTERNATIVE NUMBERS TEST FAILED ===');
        console.error('Error:', error.message);
    }
}

// Run the tests
async function runAllTests() {
    console.log('Starting email filing tests...\n');
    
    // Test 1: Full webhook simulation
    await testEmailFiling();
    
    // Test 2: Direct GetControlInformation test
    await testControlInformationDirectly();
    
    // Test 3: Try different control numbers
    await testAlternativeControlNumbers();
    
    console.log('\n=== ALL TESTS COMPLETED ===');
    process.exit(0);
}

runAllTests().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});