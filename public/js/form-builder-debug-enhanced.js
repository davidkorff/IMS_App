// Enhanced debugging for form builder
console.log('🚀 Form Builder Debug Enhanced loaded');

// Override console.log to add timestamps
const originalLog = console.log;
console.log = function(...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    originalLog(`[${timestamp}]`, ...args);
};

// Log initial state
console.log('📍 Current URL:', window.location.href);
console.log('📍 URL Parameters:', window.location.search);
console.log('📍 Has opener window:', !!window.opener);
console.log('📍 LocalStorage token exists:', !!localStorage.getItem('token'));
console.log('📍 LocalStorage instanceId:', localStorage.getItem('instanceId'));

// Check what functions are available
console.log('📍 Functions available:');
console.log('  - loadFormSchema:', typeof window.loadFormSchema);
console.log('  - fetchWithAuth:', typeof window.fetchWithAuth);
console.log('  - formSchema global:', typeof formSchema);

// Monitor when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM Content Loaded');
    
    // Check form builder state
    console.log('📊 Form Builder State:');
    console.log('  - formSchema:', window.formSchema);
    console.log('  - currentPageIndex:', window.currentPageIndex);
    console.log('  - Form pages container exists:', !!document.getElementById('formPagesContainer'));
    
    // Try to load form from URL
    const urlParams = new URLSearchParams(window.location.search);
    const formSchemaId = urlParams.get('form_schema_id');
    
    console.log('🔍 Checking for form_schema_id in URL:', formSchemaId);
    
    if (formSchemaId) {
        console.log('📥 Attempting to load form schema:', formSchemaId);
        loadFormSchemaWithDebug(formSchemaId);
    } else {
        console.log('⚠️ No form_schema_id in URL parameters');
    }
});

// Enhanced form loading with debug
async function loadFormSchemaWithDebug(formSchemaId) {
    console.log('🔄 loadFormSchemaWithDebug called with:', formSchemaId);
    
    try {
        // Get instance ID from various sources
        const instanceIdSources = {
            opener: window.opener?.instanceId,
            localStorage: localStorage.getItem('instanceId'),
            default: 4
        };
        
        console.log('🔍 Instance ID sources:', instanceIdSources);
        const instanceId = instanceIdSources.opener || instanceIdSources.localStorage || instanceIdSources.default;
        console.log('📌 Using instance ID:', instanceId);
        
        // Build the API URL
        const apiUrl = `/api/forms/schemas/${formSchemaId}`;
        console.log('🌐 API URL:', apiUrl);
        
        // Check authentication
        const token = localStorage.getItem('token');
        console.log('🔐 Auth token exists:', !!token);
        if (token) {
            console.log('🔐 Token preview:', token.substring(0, 20) + '...');
        }
        
        // Make the API call
        console.log('📡 Making API request...');
        
        let response;
        if (window.fetchWithAuth) {
            console.log('✅ Using fetchWithAuth');
            response = await window.fetchWithAuth(apiUrl);
        } else {
            console.log('⚠️ fetchWithAuth not available, using fetch');
            response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-instance-id': instanceId
                }
            });
        }
        
        console.log('📡 Response received:');
        console.log('  - Status:', response.status);
        console.log('  - Status Text:', response.statusText);
        console.log('  - Headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Response data received');
            console.log('📦 Data structure:', Object.keys(data));
            console.log('📦 Has form_schema:', !!data.form_schema);
            
            if (data.form_schema) {
                console.log('📋 Form schema structure:', {
                    id: data.form_schema.id,
                    pages: data.form_schema.pages?.length,
                    fields: Object.keys(data.form_schema.fields || {}).length,
                    version: data.form_schema.version
                });
                
                // Try to load the schema
                if (window.loadFormSchema) {
                    console.log('🎯 Calling loadFormSchema...');
                    window.loadFormSchema(data.form_schema);
                    console.log('✅ loadFormSchema called successfully');
                    
                    // Verify it loaded
                    setTimeout(() => {
                        console.log('🔍 Verifying form loaded:');
                        console.log('  - formSchema.id:', window.formSchema?.id);
                        console.log('  - formSchema.pages:', window.formSchema?.pages?.length);
                        console.log('  - DOM updated:', document.querySelectorAll('.form-field').length > 0);
                    }, 500);
                } else {
                    console.error('❌ loadFormSchema function not found!');
                    console.log('Available window functions:', Object.keys(window).filter(k => typeof window[k] === 'function').slice(0, 20));
                }
            } else {
                console.error('❌ No form_schema in response data');
                console.log('Response data:', data);
            }
        } else {
            console.error('❌ API request failed');
            const errorText = await response.text();
            console.error('Error response:', errorText);
        }
    } catch (error) {
        console.error('❌ Exception in loadFormSchemaWithDebug:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Monitor window messages
window.addEventListener('message', (event) => {
    console.log('📨 Window message received:', {
        origin: event.origin,
        data: event.data,
        source: event.source === window.opener ? 'opener' : 'other'
    });
});

// Monitor load event
window.addEventListener('load', () => {
    console.log('✅ Window load event fired');
    console.log('🔍 Final check - loadFormSchema available:', typeof window.loadFormSchema);
});

// Export for testing
window.loadFormSchemaWithDebug = loadFormSchemaWithDebug;

console.log('🚀 Form Builder Debug Enhanced setup complete');