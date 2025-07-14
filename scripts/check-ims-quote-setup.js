#!/usr/bin/env node
/**
 * Diagnostic script to check IMS quote setup
 * Usage: node scripts/check-ims-quote-setup.js <quoteGuid>
 */

const IMSService = require('../services/imsService');
const dataAccess = require('../services/dataAccess');

async function checkQuoteSetup(quoteGuid) {
    // Get instance credentials from environment or use defaults
    const imsService = new IMSService({
        url: process.env.IMS_URL || 'https://ws2.mgasystems.com/ims_insurancestrategiestest/',
        username: process.env.IMS_USERNAME || 'dkorff',
        password: process.env.IMS_PASSWORD || 'kCeTLc2bxqOmG72ZBvMFkA=='
    });
    
    console.log('\n=== IMS Quote Diagnostic Check ===');
    console.log('Quote GUID:', quoteGuid);
    console.log('\n1. Checking Quote Information...');
    
    try {
        // Get quote information
        const quoteInfo = await dataAccess.executeProc({
            url: imsService.url,
            username: imsService.username,
            password: imsService.password,
            procedure: 'DK_GetQuoteInfo_WS',
            parameters: {
                QuoteGuid: quoteGuid
            }
        });
        
        if (quoteInfo && quoteInfo.Table && quoteInfo.Table.length > 0) {
            const quote = quoteInfo.Table[0];
            console.log('✓ Quote found:');
            console.log('  - Control Number:', quote.ControlNo);
            console.log('  - Status:', quote.QuoteStatus);
            console.log('  - Company:', quote.CompanyName);
            console.log('  - Line:', quote.LineName);
            console.log('  - State:', quote.StateID);
        } else {
            console.log('✗ Quote not found in IMS');
            return;
        }
    } catch (error) {
        console.error('✗ Error getting quote info:', error.message);
    }
    
    console.log('\n2. Checking Quote Details...');
    try {
        const quoteDetails = await dataAccess.executeProc({
            url: imsService.url,
            username: imsService.username,
            password: imsService.password,
            procedure: 'DK_GetQuoteDetails_WS',
            parameters: {
                QuoteGuid: quoteGuid
            }
        });
        
        if (quoteDetails && quoteDetails.Table && quoteDetails.Table.length > 0) {
            console.log(`✓ Found ${quoteDetails.Table.length} Quote Details`);
            quoteDetails.Table.forEach((detail, index) => {
                console.log(`  Detail ${index + 1}:`, {
                    Line: detail.LineName,
                    RaterID: detail.RaterID,
                    RaterName: detail.RaterName
                });
            });
        } else {
            console.log('✗ No Quote Details found - this is why AutoAddQuoteOptions returns 0!');
            console.log('  Quote Details are required before Quote Options can be created.');
        }
    } catch (error) {
        console.error('✗ Error getting quote details:', error.message);
    }
    
    console.log('\n3. Checking Quote Options...');
    try {
        const quoteOptions = await dataAccess.executeProc({
            url: imsService.url,
            username: imsService.username,
            password: imsService.password,
            procedure: 'DK_GetQuoteOptions_WS',
            parameters: {
                QuoteGuid: quoteGuid
            }
        });
        
        if (quoteOptions && quoteOptions.Table && quoteOptions.Table.length > 0) {
            console.log(`✓ Found ${quoteOptions.Table.length} Quote Options`);
            quoteOptions.Table.forEach((option, index) => {
                console.log(`  Option ${index + 1}:`, {
                    OptionGuid: option.QuoteOptionGuid,
                    Premium: option.Premium,
                    Fees: option.Fees
                });
            });
        } else {
            console.log('✗ No Quote Options found - premium cannot be added without options!');
        }
    } catch (error) {
        console.error('✗ Error getting quote options:', error.message);
    }
    
    console.log('\n4. Checking CompanyLine Configuration...');
    try {
        const companyLineInfo = await dataAccess.executeProc({
            url: imsService.url,
            username: imsService.username,
            password: imsService.password,
            procedure: 'DK_GetCompanyLineConfig_WS',
            parameters: {
                QuoteGuid: quoteGuid
            }
        });
        
        if (companyLineInfo && companyLineInfo.Table && companyLineInfo.Table.length > 0) {
            const config = companyLineInfo.Table[0];
            console.log('✓ CompanyLine Configuration:');
            console.log('  - Has Commission Structure:', config.HasCommissions ? 'Yes' : 'No');
            console.log('  - Has Payment Terms:', config.HasPaymentTerms ? 'Yes' : 'No');
            console.log('  - Has Raters:', config.HasRaters ? 'Yes' : 'No');
        } else {
            console.log('✗ Could not retrieve CompanyLine configuration');
        }
    } catch (error) {
        console.log('ℹ CompanyLine check not available (procedure may not exist)');
    }
    
    console.log('\n=== Diagnostic Summary ===');
    console.log('To fix "No Quote Options" issue:');
    console.log('1. Ensure CompanyLine is configured in IMS for the Company/Line/State combination');
    console.log('2. CompanyLine must have Commission Structure and Payment Terms configured');
    console.log('3. Call AutoAddQuoteDetails before AutoAddQuoteOptions');
    console.log('4. Verify the rating type (RaterID) matches the Excel template');
    console.log('\n');
}

// Run if called directly
if (require.main === module) {
    const quoteGuid = process.argv[2];
    if (!quoteGuid) {
        console.error('Usage: node scripts/check-ims-quote-setup.js <quoteGuid>');
        process.exit(1);
    }
    
    checkQuoteSetup(quoteGuid).catch(console.error);
}

module.exports = { checkQuoteSetup };