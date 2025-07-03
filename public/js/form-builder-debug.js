// Add this to the beginning of form-builder.js to debug loading issues
console.log('Form Builder JS loaded');

// Override the loadFormSchema function with debug logging
const originalLoadFormSchema = window.loadFormSchema;
window.loadFormSchema = function(schema) {
    console.log('loadFormSchema called with:', schema);
    
    if (!schema) {
        console.error('No schema provided to loadFormSchema');
        return;
    }
    
    // Call the original function
    if (originalLoadFormSchema) {
        originalLoadFormSchema(schema);
    } else {
        console.error('Original loadFormSchema not found!');
    }
};

// Add debug logging for window load
window.addEventListener('load', () => {
    console.log('Form builder window loaded');
    console.log('loadFormSchema available:', typeof window.loadFormSchema);
});

// Debug message from parent
window.addEventListener('message', (event) => {
    console.log('Message received:', event.data);
});