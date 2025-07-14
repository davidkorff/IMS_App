# Form Schema JSON Interpretation Guide

## Overview

This document provides comprehensive rules for interpreting the Form Schema JSON object. Any system or developer can use these rules to correctly render, validate, and process forms defined by this schema.

## Core Schema Structure

```json
{
    "id": "unique_form_identifier",
    "version": "1.0",
    "metadata": { /* Form metadata */ },
    "pages": [ /* Array of page objects */ ],
    "fields": { /* Field definitions keyed by field ID */ },
    "logic": [ /* Conditional logic rules */ ],
    "calculations": [ /* Calculation rules */ ],
    "settings": { /* Form-level settings */ },
    "state": { /* Current form state (for saved drafts) */ }
}
```

## Interpretation Rules

### 1. Form Initialization

**Rule 1.1**: Start by reading the `metadata` object to understand the form's purpose:
```json
"metadata": {
    "title": "Display this as the form title",
    "description": "Show this as a subtitle or help text",
    "lineOfBusiness": "Internal reference to business line",
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
}
```

**Rule 1.2**: Check `settings` for form behavior configuration:
```json
"settings": {
    "allowSaveDraft": true,      // Show "Save Draft" button
    "autoSave": true,            // Enable auto-save every autoSaveInterval ms
    "autoSaveInterval": 30000,   // Auto-save frequency in milliseconds
    "showProgressBar": true,     // Display progress indicator
    "confirmOnExit": true,       // Warn before leaving with unsaved changes
    "submitButtonText": "Submit Application",
    "saveButtonText": "Save Draft"
}
```

### 2. Page Rendering

**Rule 2.1**: Render pages sequentially based on array order:
```json
"pages": [
    {
        "id": "page1",
        "title": "Basic Information",
        "description": "Optional page description",
        "order": 1,
        "sections": [ /* Array of sections */ ],
        "navigation": {
            "showPrevious": true,
            "showNext": true,
            "showSave": true,
            "nextButtonText": "Continue",
            "previousButtonText": "Back"
        }
    }
]
```

**Rule 2.2**: Only display one page at a time unless specified otherwise in settings.

**Rule 2.3**: Use `navigation` settings to control page flow buttons.

### 3. Section Rendering

**Rule 3.1**: Render sections within a page in array order:
```json
"sections": [
    {
        "id": "section1",
        "type": "fieldset",          // fieldset, repeater, grid, conditional
        "title": "Section Title",
        "description": "Optional help text",
        "layout": "1-column",        // 1-column, 2-column, 3-column, custom
        "collapsible": false,        // Can user collapse this section
        "collapsed": false,          // Start in collapsed state
        "repeatable": false,         // Is this a repeating section
        "minRepeat": 1,             // Minimum repetitions if repeatable
        "maxRepeat": null,          // Maximum repetitions (null = unlimited)
        "items": [ /* Array of items */ ],
        "visibility": {
            "condition": "all",      // all, any, none, custom
            "rules": [ /* Visibility rules */ ]
        }
    }
]
```

**Rule 3.2**: Section Types:
- `fieldset`: Standard grouping of fields
- `repeater`: Allow multiple instances (e.g., multiple addresses)
- `grid`: Arrange fields in a grid layout
- `conditional`: Show/hide based on conditions
- `fieldset-repeater`: Dynamic field collections (special field type, not section type)

**Rule 3.3**: Layout Rules:
- `1-column`: Stack all fields vertically
- `2-column`: Arrange fields in 2 columns (responsive)
- `3-column`: Arrange fields in 3 columns (responsive)
- `custom`: Use field-level width specifications

### 4. Field Rendering

**Rule 4.1**: For each item in section.items:
```json
{
    "type": "field",
    "fieldId": "field_123"  // Look up full definition in fields object
}
```

**Rule 4.2**: Retrieve field definition from `fields` object:
```json
"fields": {
    "field_123": {
        "id": "field_123",
        "type": "text",              // Field type (see Field Types section)
        "name": "insuredName",       // Name attribute for form submission
        "label": "Insured Name",     // Display label
        "placeholder": "Enter name", // Placeholder text
        "helpText": "Legal business name", // Help text below field
        "defaultValue": null,        // Pre-fill value
        "required": true,            // Is field required
        "readonly": false,           // Is field read-only
        "disabled": false,           // Is field disabled
        "validation": { /* Validation rules */ },
        "display": { /* Display properties */ },
        "dependencies": { /* Field dependencies */ }
    }
}
```

### 5. Field Types and Rendering Rules

**Rule 5.1**: Basic Input Fields
```json
"type": "text|number|email|phone|url|password"
```
- Render as `<input type="{type}">`
- Apply validation rules
- Use placeholder and defaultValue

**Rule 5.2**: Date/Time Fields
```json
"type": "date|time|datetime"
```
- Render appropriate date/time picker
- Format according to locale settings
- Validate min/max dates if specified

**Rule 5.3**: Selection Fields
```json
"type": "select|radio|checkbox",
"options": [
    {
        "value": "option1",
        "label": "Option 1",
        "disabled": false
    }
]
```
- `select`: Render as dropdown
- `radio`: Render as radio button group
- `checkbox`: Single checkbox or checkbox group if multiple options

**Rule 5.4**: Special Fields
```json
"type": "file|signature|address|rating|slider"
```
- `file`: File upload with accept attribute
- `signature`: Signature pad canvas
- `address`: Composite field with street, city, state, zip
- `rating`: Star rating selector
- `slider`: Range slider with min/max

**Rule 5.5**: Fieldset Repeater Fields
```json
"type": "fieldset-repeater",
"minItems": 0,
"maxItems": 50,
"defaultItems": 0,
"addButtonText": "+ Add Item",
"removeButtonText": "Remove",
"itemLabel": "Item #{index}",
"collapsible": true,
"fields": [
    {
        "id": "field_id",
        "type": "text",
        "name": "field_name",
        "label": "Field Label",
        "required": true
    }
]
```
- Dynamic collection of fields that users can add/remove
- Essential for insurance scenarios (vehicles, locations, additional insureds)
- Renders with add/remove buttons within min/max limits
- Each item contains the defined fields
- Supports collapsible items for better organization
- Use `{fieldName}` in itemLabel to display field values dynamically

### 6. Validation Rules

**Rule 6.1**: Apply validation on field blur and before submission:
```json
"validation": {
    "required": true,
    "minLength": 5,
    "maxLength": 50,
    "min": 0,                // For numbers/dates
    "max": 100,              // For numbers/dates
    "pattern": "^[A-Z]{2}$", // Regex pattern
    "custom": "validateSSN", // Custom validation function name
    "messages": {
        "required": "This field is required",
        "pattern": "Please enter valid format"
    }
}
```

**Rule 6.2**: Display validation errors:
- Show error message below field
- Add error styling to field
- Prevent form submission until valid

### 7. Conditional Logic

**Rule 7.1**: Evaluate logic rules after any field change:
```json
"logic": [
    {
        "id": "rule1",
        "name": "Show commercial questions",
        "priority": 1,              // Lower number = higher priority
        "trigger": {
            "type": "field",
            "operator": "all",      // all, any, none
            "conditions": [
                {
                    "field": "businessType",
                    "operator": "equals",    // equals, notEquals, contains, etc.
                    "value": "commercial",
                    "caseInsensitive": true
                }
            ]
        },
        "actions": [
            {
                "type": "visibility",    // visibility, value, validation, style
                "action": "show",        // show, hide, toggle, setValue, etc.
                "target": "section_commercial",
                "value": null,
                "params": {}
            }
        ]
    }
]
```

**Rule 7.2**: Operators for conditions:
- `equals`, `notEquals`: Exact match
- `contains`, `notContains`: String contains
- `startsWith`, `endsWith`: String operations
- `greaterThan`, `lessThan`: Numeric comparison
- `between`, `notBetween`: Range check
- `empty`, `notEmpty`: Presence check
- `regex`: Regular expression match

**Rule 7.3**: Action types:
- `visibility`: Show/hide elements
- `value`: Set field values
- `validation`: Change validation rules
- `style`: Apply CSS classes

### 8. Calculations

**Rule 8.1**: Execute calculations when dependencies change:
```json
"calculations": [
    {
        "id": "calc1",
        "name": "Calculate total",
        "target": "totalAmount",     // Field to update
        "formula": "{field1} + {field2} * {field3}",
        "trigger": "onChange",       // onChange, onBlur, manual
        "precision": 2,              // Decimal places
        "dependencies": ["field1", "field2", "field3"]
    }
]
```

**Rule 8.2**: Formula interpretation:
- Replace `{fieldName}` with field values
- Support basic math operators: +, -, *, /, %
- Support functions: SUM, AVG, MIN, MAX, ROUND
- Handle null/empty values as 0

### 9. Display Properties

**Rule 9.1**: Apply display properties to fields:
```json
"display": {
    "width": "50%",          // Field width (25%, 33%, 50%, 75%, 100%)
    "className": "custom-class",
    "icon": "fa-user",       // Icon class
    "prefix": "$",           // Display prefix
    "suffix": ".00",         // Display suffix
    "mask": "(999) 999-9999" // Input mask
}
```

### 10. State Management

**Rule 10.1**: Handle form state for drafts:
```json
"state": {
    "currentPage": 0,        // Current page index
    "data": {                // Form data keyed by field name
        "insuredName": "ABC Company",
        "businessType": "commercial"
    },
    "errors": {              // Validation errors
        "email": ["Invalid email format"]
    },
    "touched": {             // Fields that have been interacted with
        "insuredName": true
    },
    "submitted": false,
    "savedAt": "2024-01-07T10:30:00Z",
    "completedPages": ["page1", "page2"]
}
```

**Rule 10.2**: When loading a draft:
1. Restore `currentPage`
2. Pre-fill fields with `data` values
3. Mark fields as `touched`
4. Show any existing `errors`
5. Enable navigation to `completedPages`

### 11. Data Submission

**Rule 11.1**: Collect data for submission:
```javascript
{
    "formId": "form_123",
    "formData": {
        // Key-value pairs using field 'name' property
        "insuredName": "ABC Company",
        "businessType": "commercial",
        "addresses": [  // For repeater sections
            {
                "street": "123 Main St",
                "city": "Anytown",
                "state": "CA",
                "zip": "12345"
            }
        ],
        "vehicles": [  // For fieldset-repeater fields
            {
                "year": 2020,
                "make": "Ford",
                "model": "F-150",
                "vin": "1FTFW1ET5LFA12345"
            },
            {
                "year": 2019,
                "make": "Chevrolet",
                "model": "Silverado",
                "vin": "1GCUYDED6KZ123456"
            }
        ]
    },
    "metadata": {
        "submittedAt": "2024-01-07T10:30:00Z",
        "completionTime": 300, // Seconds to complete
        "source": "producer_portal"
    }
}
```

### 12. Special Handling Rules

**Rule 12.1**: Repeater Sections
- Generate unique field names: `{baseName}[{index}].{fieldName}`
- Allow add/remove buttons within min/max limits
- Validate each repetition independently

**Rule 12.5**: Fieldset Repeater Fields
- Handle as a special field type, not a section type
- Store data as array of objects: `[{field1: value1, field2: value2}, ...]`
- Preserve field event handlers when adding/removing items
- Support nested validation for each item's fields
- Enable/disable add button based on maxItems
- Enable/disable remove button based on minItems
- Update itemLabel dynamically if it contains field references

**Rule 12.2**: File Uploads
- Validate file type against `accept` attribute
- Check file size against `maxSize` property
- Support multiple files if `multiple: true`

**Rule 12.3**: Address Fields
```json
"includeFields": ["street", "city", "state", "zip", "country"]
```
- Render only specified address components
- Group as single logical unit
- Submit as nested object

**Rule 12.4**: Conditional Sections
- Evaluate visibility rules before rendering
- Re-evaluate on any dependent field change
- Skip validation for hidden fields

### 13. Error Handling

**Rule 13.1**: Schema Validation
- Verify required properties exist
- Validate field types are recognized
- Check field references in logic/calculations exist

**Rule 13.2**: Runtime Errors
- Gracefully handle missing field definitions
- Provide fallback for unknown field types
- Log errors without breaking form functionality

### 14. Progressive Enhancement

**Rule 14.1**: Required Features
- Basic field rendering and validation
- Page navigation
- Data collection and submission

**Rule 14.2**: Optional Features
- Conditional logic
- Calculations
- Auto-save
- Progress indicators
- Input masks

### 15. Accessibility Requirements

**Rule 15.1**: ARIA Labels
- Add `aria-label` to fields without visible labels
- Use `aria-describedby` for help text
- Mark required fields with `aria-required="true"`

**Rule 15.2**: Keyboard Navigation
- Ensure all interactive elements are keyboard accessible
- Provide skip links for long forms
- Maintain logical tab order

## Example Implementation Pseudocode

```javascript
function renderForm(schema) {
    // 1. Validate schema
    validateSchema(schema);
    
    // 2. Initialize form state
    const state = schema.state || createDefaultState();
    
    // 3. Render current page
    const currentPage = schema.pages[state.currentPage];
    renderPage(currentPage);
    
    // 4. Apply conditional logic
    evaluateAllLogic(schema.logic, state.data);
    
    // 5. Setup event handlers
    attachFieldHandlers(schema);
    
    // 6. Setup auto-save if enabled
    if (schema.settings.autoSave) {
        setInterval(() => saveFormState(state), 
                   schema.settings.autoSaveInterval);
    }
}

function renderPage(page) {
    // Render page title and description
    // For each section in page.sections
    //   Check visibility rules
    //   Render section based on type
    //   For each item in section.items
    //     Render field from field definition
}

function renderField(fieldDef, value) {
    // Create appropriate input element
    // Apply display properties
    // Set validation attributes
    // Attach event handlers
    // Show existing value if any
}
```

## Validation Examples

```javascript
// Required field
if (field.required && !value) {
    return field.validation.messages.required || 
           `${field.label} is required`;
}

// Pattern matching
if (field.validation.pattern) {
    const regex = new RegExp(field.validation.pattern);
    if (!regex.test(value)) {
        return field.validation.messages.pattern || 
               'Invalid format';
    }
}

// Conditional required
if (logicMakesFieldRequired(field.id) && !value) {
    return `${field.label} is required based on your previous answers`;
}
```

This interpretation guide ensures consistent form behavior across all systems implementing the schema.