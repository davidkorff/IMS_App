// Email processing configuration
module.exports = {
    // Switch between email processing modes
    // 'plus' - Use plus addressing (documents+suffix@42consultingllc.com)
    // 'subdomain' - Use subdomain routing (prefix@subdomain.42consultingllc.com)
    EMAIL_PROCESSING_MODE: process.env.EMAIL_PROCESSING_MODE || 'subdomain',
    
    // Catch-all inbox for subdomain mode
    CATCH_ALL_INBOX: process.env.CATCH_ALL_INBOX || 'documents@42consultingllc.com',
    
    // Processing interval in minutes
    PROCESSING_INTERVAL: parseInt(process.env.EMAIL_PROCESSING_INTERVAL) || 5,
    
    // Domain for subdomain emails
    BASE_DOMAIN: process.env.BASE_DOMAIN || '42ims.com'
};