// Form Builder Fix - Add this to form-builder.js after DOMContentLoaded

// Check if we're being opened from producer-admin
document.addEventListener('DOMContentLoaded', function() {
    console.log('Form Builder loaded');
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const formSchemaId = urlParams.get('form_schema_id');
    
    console.log('URL params:', urlParams.toString());
    console.log('Form Schema ID from URL:', formSchemaId);
    
    // If we have a form_schema_id in URL, load it
    if (formSchemaId) {
        loadFormSchemaById(formSchemaId);
    }
});

// Function to load form schema by ID
async function loadFormSchemaById(formSchemaId) {
    console.log('Loading form schema:', formSchemaId);
    
    try {
        // Get instance ID from parent window or localStorage
        const instanceId = window.opener?.instanceId || localStorage.getItem('instanceId') || 4;
        
        // Use fetchWithAuth if available, otherwise use regular fetch
        const fetchFn = window.fetchWithAuth || fetch;
        const headers = window.fetchWithAuth ? {} : {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'x-instance-id': instanceId
        };
        
        const response = await fetchFn(`/api/forms/schemas/${formSchemaId}`, {
            headers: headers
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Form schema data:', data);
            
            if (data.form_schema) {
                // Load the schema into the form builder
                if (window.loadFormSchema) {
                    window.loadFormSchema(data.form_schema);
                } else {
                    console.error('loadFormSchema function not found!');
                }
            }
        } else {
            const error = await response.json();
            console.error('Error loading form schema:', error);
        }
    } catch (error) {
        console.error('Failed to load form schema:', error);
    }
}

// Expose function to parent window
window.loadFormSchemaById = loadFormSchemaById;