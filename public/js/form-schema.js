/**
 * Form Schema Definition
 * 
 * This defines the structure for dynamic forms that can be:
 * - Stored in database
 * - Sent to any API
 * - Rendered dynamically
 * - Support partial saves
 * - Include conditional logic
 * - Support calculations
 */

// Form Schema Structure
const FormSchema = {
    id: '',                    // Unique form ID
    version: '1.0',           // Schema version
    metadata: {
        title: '',            // Form title
        description: '',      // Form description
        lineOfBusiness: '',   // Associated LOB
        createdAt: null,      // Creation timestamp
        updatedAt: null,      // Last update timestamp
        createdBy: '',        // User who created
        tags: []              // Searchable tags
    },
    
    // Form pages (multi-step forms)
    pages: [
        {
            id: '',           // Page ID
            title: '',        // Page title
            description: '',  // Page description
            order: 1,         // Display order
            
            // Sections within page
            sections: [
                {
                    id: '',                  // Section ID
                    type: 'fieldset',        // fieldset, repeater, grid, conditional
                    title: '',               // Section title
                    description: '',         // Section help text
                    layout: '1-column',      // 1-column, 2-column, 3-column, custom
                    collapsible: false,      // Can section be collapsed
                    collapsed: false,        // Start collapsed
                    repeatable: false,       // Can section be repeated (for multiple locations, vehicles, etc.)
                    minRepeat: 1,           // Minimum repetitions
                    maxRepeat: null,        // Maximum repetitions (null = unlimited)
                    
                    // Fields or nested sections
                    items: [
                        {
                            type: 'field',   // field, section, html, component
                            field: {}        // Field definition (see below)
                        }
                    ],
                    
                    // Visibility rules
                    visibility: {
                        condition: 'all',    // all, any, none, custom
                        rules: []            // Array of condition rules
                    }
                }
            ],
            
            // Navigation rules
            navigation: {
                showPrevious: true,
                showNext: true,
                showSave: true,
                nextButtonText: 'Continue',
                previousButtonText: 'Back'
            }
        }
    ],
    
    // Field definitions (reusable across form)
    fields: {
        'fieldId': {
            id: '',                  // Unique field ID
            type: 'text',           // text, number, email, phone, date, select, radio, checkbox, textarea, file, signature, etc.
            name: '',               // Field name for data storage
            label: '',              // Display label
            placeholder: '',        // Placeholder text
            helpText: '',           // Help text below field
            defaultValue: null,     // Default value
            required: false,        // Is required
            readonly: false,        // Is readonly
            disabled: false,        // Is disabled
            
            // Validation rules
            validation: {
                required: false,
                minLength: null,
                maxLength: null,
                min: null,          // For numbers/dates
                max: null,          // For numbers/dates
                pattern: null,      // Regex pattern
                custom: null,       // Custom validation function name
                messages: {         // Custom error messages
                    required: '',
                    minLength: '',
                    pattern: ''
                }
            },
            
            // Options for select, radio, checkbox
            options: [
                {
                    value: '',
                    label: '',
                    disabled: false
                }
            ],
            
            // Data source for dynamic options
            dataSource: {
                type: null,         // static, api, database, function
                endpoint: '',       // API endpoint
                valueField: '',     // Field for option value
                labelField: '',     // Field for option label
                params: {},         // Parameters to send
                cache: true         // Cache results
            },
            
            // Display properties
            display: {
                width: '100%',      // Field width
                className: '',      // CSS classes
                icon: '',           // Icon to display
                prefix: '',         // Prefix (like $)
                suffix: '',         // Suffix (like .00)
                mask: ''            // Input mask
            },
            
            // Dependencies
            dependencies: {
                fields: [],         // Fields this depends on
                calculation: null   // Calculation formula
            }
        }
    },
    
    // Conditional logic rules
    logic: [
        {
            id: '',                 // Rule ID
            name: '',               // Rule name for debugging
            priority: 1,            // Execution priority
            
            // Trigger conditions
            trigger: {
                type: 'field',      // field, calculation, always
                operator: 'all',    // all, any, none
                conditions: [
                    {
                        field: '',  // Field ID
                        operator: '',       // equals, notEquals, contains, greaterThan, etc.
                        value: null,        // Comparison value
                        caseInsensitive: false
                    }
                ]
            },
            
            // Actions to perform
            actions: [
                {
                    type: 'visibility',     // visibility, value, validation, style
                    action: 'show',         // show, hide, toggle, setValue, addClass, etc.
                    target: '',             // Target field/section ID
                    value: null,            // Value for setValue actions
                    params: {}              // Additional parameters
                }
            ]
        }
    ],
    
    // Calculations
    calculations: [
        {
            id: '',                 // Calculation ID
            name: '',               // Calculation name
            target: '',             // Target field to update
            formula: '',            // Calculation formula
            trigger: 'onChange',    // onChange, onBlur, manual
            precision: 2,           // Decimal precision
            dependencies: []        // Fields used in calculation
        }
    ],
    
    // Form settings
    settings: {
        allowSaveDraft: true,       // Allow saving incomplete forms
        autoSave: true,             // Auto-save periodically
        autoSaveInterval: 30000,    // Auto-save interval (ms)
        showProgressBar: true,      // Show progress indicator
        confirmOnExit: true,        // Confirm before leaving with unsaved changes
        submitButtonText: 'Submit Application',
        saveButtonText: 'Save Draft',
        
        // Submission settings
        submission: {
            endpoint: '',           // API endpoint for submission
            method: 'POST',         // HTTP method
            headers: {},            // Additional headers
            transformData: null,    // Function to transform data before sending
            redirectOnSuccess: '',  // Redirect URL after success
            showConfirmation: true  // Show confirmation message
        },
        
        // Styling
        theme: {
            primaryColor: '#007bff',
            errorColor: '#dc3545',
            successColor: '#28a745',
            fontFamily: 'inherit'
        }
    },
    
    // Data transformation rules
    dataMap: {
        // Map form fields to API fields
        toAPI: {
            'formFieldName': 'apiFieldName'
        },
        // Map API fields to form fields
        fromAPI: {
            'apiFieldName': 'formFieldName'
        }
    },
    
    // Hooks for custom code
    hooks: {
        onInit: null,           // Function name to call on form init
        onPageChange: null,     // Function name to call on page change
        beforeSubmit: null,     // Function name to call before submit
        afterSubmit: null,      // Function name to call after submit
        onError: null,          // Function name to call on error
        onFieldChange: null     // Function name to call on field change
    },
    
    // Form state (for saved drafts)
    state: {
        currentPage: 0,         // Current page index
        data: {},               // Form data
        errors: {},             // Validation errors
        touched: {},            // Fields that have been touched
        submitted: false,       // Has been submitted
        savedAt: null,          // Last save timestamp
        completedPages: []      // Completed page IDs
    }
};

// Field type definitions
const FieldTypes = {
    // Basic inputs
    TEXT: 'text',
    NUMBER: 'number',
    EMAIL: 'email',
    PHONE: 'phone',
    URL: 'url',
    PASSWORD: 'password',
    
    // Date/Time
    DATE: 'date',
    TIME: 'time',
    DATETIME: 'datetime',
    
    // Selections
    SELECT: 'select',
    RADIO: 'radio',
    CHECKBOX: 'checkbox',
    TOGGLE: 'toggle',
    
    // Text areas
    TEXTAREA: 'textarea',
    RICHTEXT: 'richtext',
    
    // Special inputs
    FILE: 'file',
    IMAGE: 'image',
    SIGNATURE: 'signature',
    RATING: 'rating',
    SLIDER: 'slider',
    COLOR: 'color',
    
    // Complex types
    ADDRESS: 'address',
    LOCATION: 'location',
    REPEATER: 'repeater',
    GRID: 'grid',
    
    // Display only
    HEADING: 'heading',
    PARAGRAPH: 'paragraph',
    DIVIDER: 'divider',
    HTML: 'html',
    
    // Calculated
    CALCULATED: 'calculated',
    LOOKUP: 'lookup'
};

// Layout types
const LayoutTypes = {
    ONE_COLUMN: '1-column',
    TWO_COLUMN: '2-column',
    THREE_COLUMN: '3-column',
    FOUR_COLUMN: '4-column',
    CUSTOM: 'custom'
};

// Validation operators
const ValidationOperators = {
    EQUALS: 'equals',
    NOT_EQUALS: 'notEquals',
    CONTAINS: 'contains',
    NOT_CONTAINS: 'notContains',
    STARTS_WITH: 'startsWith',
    ENDS_WITH: 'endsWith',
    GREATER_THAN: 'greaterThan',
    GREATER_THAN_OR_EQUAL: 'greaterThanOrEqual',
    LESS_THAN: 'lessThan',
    LESS_THAN_OR_EQUAL: 'lessThanOrEqual',
    BETWEEN: 'between',
    NOT_BETWEEN: 'notBetween',
    IN: 'in',
    NOT_IN: 'notIn',
    EMPTY: 'empty',
    NOT_EMPTY: 'notEmpty',
    REGEX: 'regex'
};

// Action types
const ActionTypes = {
    SHOW: 'show',
    HIDE: 'hide',
    ENABLE: 'enable',
    DISABLE: 'disable',
    REQUIRE: 'require',
    OPTIONAL: 'optional',
    SET_VALUE: 'setValue',
    CLEAR_VALUE: 'clearValue',
    ADD_CLASS: 'addClass',
    REMOVE_CLASS: 'removeClass',
    SET_OPTIONS: 'setOptions',
    VALIDATE: 'validate',
    CALCULATE: 'calculate',
    FETCH_DATA: 'fetchData',
    SUBMIT: 'submit',
    NAVIGATE: 'navigate'
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FormSchema,
        FieldTypes,
        LayoutTypes,
        ValidationOperators,
        ActionTypes
    };
}