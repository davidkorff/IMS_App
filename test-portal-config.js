// Test script to update portal configuration with custom CSS and JS
// This helps debug logo loading issues

const testConfig = {
    instanceId: 4, // Update this to your instance ID
    portal_name: "ISC Producer Portal",
    logo_url: "https://www.iscmga.com/wp-content/uploads/2022/02/ISC_logo_NEW-1.svg",
    primary_color: "#ff0000",
    secondary_color: "#bf0808",
    custom_css: `
        /* Custom CSS for ISC Portal */
        .navbar-brand img {
            max-height: 50px !important;
            width: auto !important;
            filter: brightness(0) invert(1); /* Make logo white for dark backgrounds */
        }
        
        .navbar-brand {
            font-weight: bold;
        }
        
        /* Debug: Show logo container */
        #navLogo {
            border: 1px dashed yellow;
            padding: 5px;
            background: rgba(255,255,255,0.1);
        }
    `,
    custom_js: `
        // Custom JavaScript for ISC Portal
        console.log('ISC Portal custom JS loaded!');
        
        // Add fallback logo handling
        const logo = document.getElementById('navLogo');
        if (logo) {
            // Try alternative logo if SVG fails
            logo.addEventListener('error', function() {
                console.log('Primary logo failed, trying fallback...');
                // You can set a fallback logo URL here
                // logo.src = '/images/fallback-logo.png';
            });
            
            logo.addEventListener('load', function() {
                console.log('Logo loaded successfully:', this.src);
            });
        }
        
        // Custom welcome message
        const welcomeEl = document.querySelector('h2');
        if (welcomeEl) {
            welcomeEl.innerHTML = welcomeEl.innerHTML.replace('Welcome,', 'Welcome to ISC,');
        }
    `,
    welcome_message: "Welcome to the ISC Producer Portal",
    terms_of_service: "By using this portal, you agree to ISC's terms of service.",
    is_active: true
};

console.log('Test Portal Configuration:');
console.log(JSON.stringify(testConfig, null, 2));
console.log('\nTo update your portal configuration:');
console.log('1. Run the migration: node run-migration-020.js');
console.log('2. Use the admin panel to update these settings');
console.log('3. Or update directly in the database using this config');