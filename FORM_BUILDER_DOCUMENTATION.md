# Form Builder System Documentation

## Overview

The Form Builder System is a comprehensive solution for creating dynamic, schema-based forms that can be used throughout the IMS application, particularly in the Producer Portal for submission intake forms.

## Architecture

### Core Components

1. **Form Schema (`/public/js/form-schema.js`)**
   - Defines the structure for dynamic forms
   - Supports pages, sections, fields, conditional logic, and calculations
   - Designed to be database-storable, API-compatible, and version-controlled

2. **Form Builder UI (`/public/form-builder.html` & `/public/js/form-builder.js`)**
   - Visual drag-and-drop interface for creating forms
   - Three-panel layout: field palette, form canvas, and properties panel
   - Supports multiple pages, sections, and 20+ field types
   - Real-time preview and undo/redo functionality

3. **Form Renderer (`/public/js/form-renderer.js`)**
   - Interprets form schemas and renders them as functional HTML forms
   - Handles field validation, conditional logic, and calculations
   - Supports draft saving and multi-page navigation
   - Provides hooks for custom behavior

4. **API Endpoints (`/routes/formBuilder.js`)**
   - CRUD operations for form schemas
   - Form submission management
   - Template management
   - LOB integration

## Database Schema

### Tables

1. **form_schemas**
   ```sql
   - form_id (UUID, Primary Key)
   - instance_id (Integer, Foreign Key)
   - lob_id (UUID, Foreign Key, optional)
   - schema_version (VARCHAR)
   - title (VARCHAR)
   - description (TEXT)
   - form_schema (JSONB)
   - is_active (BOOLEAN)
   - is_template (BOOLEAN)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)
   - created_by (Integer, Foreign Key)
   - updated_by (Integer, Foreign Key)
   ```

2. **form_submissions**
   ```sql
   - submission_id (UUID, Primary Key)
   - form_id (UUID, Foreign Key)
   - producer_id (UUID, Foreign Key)
   - submission_guid (UUID, Foreign Key)
   - form_data (JSONB)
   - form_state (JSONB)
   - is_draft (BOOLEAN)
   - completed_at (TIMESTAMP)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)
   ```

3. **form_templates**
   ```sql
   - template_id (UUID, Primary Key)
   - instance_id (Integer, Foreign Key)
   - name (VARCHAR)
   - description (TEXT)
   - category (VARCHAR)
   - template_schema (JSONB)
   - is_public (BOOLEAN)
   - created_at (TIMESTAMP)
   - created_by (Integer, Foreign Key)
   ```

## Form Schema Structure

```javascript
{
    id: '',                    // Unique form ID
    version: '1.0',           // Schema version
    metadata: {
        title: '',            // Form title
        description: '',      // Form description
        lineOfBusiness: '',   // Associated LOB
        createdAt: null,      // Creation timestamp
        updatedAt: null,      // Last update timestamp
    },
    pages: [{
        id: '',               // Page ID
        title: '',            // Page title
        sections: [{
            id: '',           // Section ID
            type: '',         // fieldset, repeater, grid, conditional
            title: '',        // Section title
            items: [{
                type: 'field',
                fieldId: ''   // Reference to field definition
            }]
        }]
    }],
    fields: {
        'fieldId': {
            id: '',           // Field ID
            type: '',         // text, number, email, select, etc.
            name: '',         // Field name for data
            label: '',        // Display label
            required: false,  // Is required
            validation: {},   // Validation rules
            display: {}       // Display properties
        }
    },
    logic: [],               // Conditional logic rules
    calculations: [],        // Calculation rules
    settings: {}            // Form settings
}
```

## Field Types Supported

- **Basic Input**: text, number, email, phone, url, password
- **Date/Time**: date, time, datetime
- **Selection**: select, radio, checkbox, toggle
- **Text Areas**: textarea, richtext
- **Special**: file, image, signature, rating, slider, color
- **Complex**: address, location, fieldset-repeater, grid
- **Display**: heading, paragraph, divider, html

## Repeatable Fields (fieldset-repeater)

The `fieldset-repeater` type enables dynamic collections of fields that users can add/remove as needed. This is essential for insurance scenarios where the number of items varies (vehicles, locations, additional insureds, etc.).

### Structure

```javascript
{
    "id": "unique_id",
    "type": "fieldset-repeater",
    "name": "field_name",
    "label": "Display Label",
    "helpText": "Optional help text",
    "minItems": 0,                    // Minimum number of items (0 = optional)
    "maxItems": 50,                   // Maximum allowed items
    "defaultItems": 0,                // Number of items to show initially
    "addButtonText": "+ Add Item",    // Custom add button text
    "removeButtonText": "Remove",     // Custom remove button text
    "itemLabel": "Item #{index}",     // Dynamic label template
    "collapsible": true,              // Allow collapse/expand of items
    "fields": [                       // Array of fields in each item
        {
            "id": "field_id",
            "type": "text",
            "name": "field_name",
            "label": "Field Label",
            "required": true
        }
    ]
}
```

### Real-World Insurance Examples

#### 1. Vehicle Information
```javascript
{
    "id": "vehicles",
    "type": "fieldset-repeater",
    "name": "vehicles",
    "label": "Vehicle Information",
    "minItems": 0,
    "maxItems": 50,
    "defaultItems": 0,
    "addButtonText": "+ Add Vehicle",
    "removeButtonText": "Remove",
    "itemLabel": "Vehicle #{index}",
    "collapsible": true,
    "fields": [
        {
            "id": "year",
            "type": "number",
            "name": "year",
            "label": "Year",
            "required": true,
            "placeholder": "e.g., 2020",
            "validation": {
                "min": 1900,
                "max": 2025
            }
        },
        {
            "id": "make",
            "type": "text",
            "name": "make",
            "label": "Make",
            "required": true,
            "placeholder": "e.g., Ford"
        },
        {
            "id": "model",
            "type": "text",
            "name": "model",
            "label": "Model",
            "required": true,
            "placeholder": "e.g., F-150"
        },
        {
            "id": "vin",
            "type": "text",
            "name": "vin",
            "label": "VIN",
            "required": true,
            "placeholder": "Vehicle Identification Number"
        }
    ]
}
```

#### 2. Additional Locations
```javascript
{
    "id": "locations",
    "type": "fieldset-repeater",
    "name": "locations",
    "label": "Additional Locations",
    "minItems": 0,
    "maxItems": 100,
    "defaultItems": 0,
    "addButtonText": "+ Add Location",
    "removeButtonText": "Remove",
    "itemLabel": "Location #{index}",
    "collapsible": true,
    "fields": [
        {
            "id": "location_type",
            "type": "select",
            "name": "location_type",
            "label": "Location Type",
            "required": true,
            "options": [
                {"value": "owned", "label": "Owned"},
                {"value": "leased", "label": "Leased"},
                {"value": "client", "label": "Client Site"},
                {"value": "temporary", "label": "Temporary"}
            ]
        },
        {
            "id": "street",
            "type": "text",
            "name": "street",
            "label": "Street Address",
            "required": true
        },
        {
            "id": "city",
            "type": "text",
            "name": "city",
            "label": "City",
            "required": true
        },
        {
            "id": "state",
            "type": "select",
            "name": "state",
            "label": "State",
            "required": true,
            "options": [/* state options */]
        },
        {
            "id": "zip",
            "type": "text",
            "name": "zip",
            "label": "ZIP Code",
            "required": true,
            "validation": {
                "pattern": "^\\d{5}(-\\d{4})?$"
            }
        }
    ]
}
```

#### 3. Additional Insureds
```javascript
{
    "id": "additional_insureds",
    "type": "fieldset-repeater",
    "name": "additional_insureds",
    "label": "Additional Insureds",
    "minItems": 0,
    "maxItems": 50,
    "defaultItems": 0,
    "addButtonText": "+ Add Additional Insured",
    "removeButtonText": "Remove",
    "itemLabel": "{name}",  // Uses field value in label
    "fields": [
        {
            "id": "name",
            "type": "text",
            "name": "name",
            "label": "Name",
            "required": true
        },
        {
            "id": "relationship",
            "type": "select",
            "name": "relationship",
            "label": "Relationship",
            "required": true,
            "options": [
                {"value": "landlord", "label": "Landlord"},
                {"value": "lender", "label": "Mortgage Holder/Lender"},
                {"value": "contractor", "label": "General Contractor"},
                {"value": "client", "label": "Client"},
                {"value": "partner", "label": "Business Partner"},
                {"value": "other", "label": "Other"}
            ]
        },
        {
            "id": "coverage_type",
            "type": "checkbox",
            "name": "coverage_type",
            "label": "Coverage Types Required",
            "options": [
                {"value": "primary", "label": "Primary Coverage"},
                {"value": "noncontributory", "label": "Primary & Non-Contributory"},
                {"value": "waiver", "label": "Waiver of Subrogation"},
                {"value": "completed_ops", "label": "Completed Operations"}
            ]
        }
    ]
}
```

### Using with Conditional Logic

Repeatable fields can be shown/hidden based on other field values:

```javascript
{
    "pages": [{
        "sections": [
            {
                "id": "section_vehicle_question",
                "items": [
                    {"type": "field", "fieldId": "has_vehicles"}
                ]
            },
            {
                "id": "section_vehicles",
                "items": [
                    {"type": "field", "fieldId": "vehicles"}
                ],
                "visibility": {
                    "condition": "all",
                    "rules": [{
                        "field": "has_vehicles",
                        "operator": "equals",
                        "value": "yes"
                    }]
                }
            }
        ]
    }],
    "fields": {
        "has_vehicles": {
            "id": "has_vehicles",
            "type": "radio",
            "name": "has_vehicles",
            "label": "Does this location have any vehicles?",
            "required": true,
            "options": [
                {"value": "yes", "label": "Yes"},
                {"value": "no", "label": "No"}
            ]
        },
        "vehicles": {
            "id": "vehicles",
            "type": "fieldset-repeater",
            // ... repeater configuration
        }
    }
}
```

### Data Structure

When submitted, repeatable fields produce an array of objects:

```javascript
{
    "vehicles": [
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
    ],
    "additional_insureds": [
        {
            "name": "ABC Property Management",
            "relationship": "landlord",
            "coverage_type": ["primary", "waiver"]
        }
    ]
}
```

## Features

### Form Builder Features
- Drag-and-drop field placement
- Multi-page form support
- Section management with collapsible panels
- Field property editing
- Options management for select/radio/checkbox fields
- Conditional logic builder (planned enhancement)
- Form preview
- Template library
- Save and load schemas

### Form Renderer Features
- Dynamic form generation from schema
- Field validation (required, pattern, min/max, etc.)
- Conditional visibility
- Calculations between fields
- Draft saving
- Progress tracking
- Auto-save capability
- Custom styling support

## Integration with Producer Portal

### Lines of Business (LOB) Configuration
1. When creating/editing a LOB, admins can click "Advanced Form Builder"
2. This opens the form builder in a new window
3. Forms are automatically saved and linked to the LOB
4. Producers see the custom form when creating submissions

### Producer Submission Flow
1. Producer selects a Line of Business
2. System checks if LOB has a custom form schema
3. If yes: Renders using FormRenderer
4. If no: Falls back to default form
5. Submissions are saved with structured data

## API Usage

### Save Form Schema
```javascript
POST /api/forms/schemas
{
    "lob_id": "uuid",
    "title": "Workers Compensation Application",
    "description": "Application form for WC coverage",
    "form_schema": { /* schema object */ }
}
```

### Get Form Schema
```javascript
GET /api/forms/schemas/:formId
```

### Save Form Submission
```javascript
POST /api/forms/submissions
{
    "form_id": "uuid",
    "submission_guid": "uuid",
    "form_data": { /* form data */ },
    "form_state": { /* state for drafts */ },
    "is_draft": false
}
```

## Form Rendering Example

```javascript
// Initialize form renderer
const formRenderer = new FormRenderer(schema, containerElement, {
    mode: 'fill',
    showProgress: true,
    autoSave: true,
    onFieldChange: (field, value) => {
        console.log('Field changed:', field.name, value);
    },
    onSubmit: async (formData) => {
        // Handle form submission
        await submitForm(formData);
    }
});
```

## Best Practices

1. **Schema Design**
   - Keep forms focused and organized into logical sections
   - Use pages for multi-step processes
   - Provide clear labels and help text
   - Set appropriate validation rules

2. **Performance**
   - Limit the number of fields per page (recommended: 20-30)
   - Use conditional logic to show/hide sections as needed
   - Enable auto-save for long forms

3. **User Experience**
   - Group related fields together
   - Use appropriate field types (e.g., email for email addresses)
   - Provide inline validation feedback
   - Show progress indicators for multi-page forms

4. **Repeatable Fields**
   - Use fieldset-repeater for dynamic collections (vehicles, locations, etc.)
   - Set reasonable minItems/maxItems limits to prevent UI overload
   - Provide clear addButtonText to guide users
   - Use collapsible: true for better organization when items have many fields
   - Consider using dynamic itemLabel with field values for better identification

## Future Enhancements

1. **Conditional Logic UI**
   - Visual rule builder
   - Complex condition support (AND/OR)
   - Action chaining

2. **Calculation Builder**
   - Visual formula editor
   - Support for complex calculations
   - Real-time preview

3. **Advanced Features**
   - Digital signature integration
   - File upload with preview
   - Address autocomplete
   - Dynamic option loading from APIs

4. **Analytics**
   - Form completion rates
   - Field-level analytics
   - A/B testing support

## Troubleshooting

### Common Issues

1. **Form not loading**
   - Check if form schema exists in database
   - Verify LOB has form_schema_id set
   - Check browser console for errors

2. **Validation not working**
   - Ensure validation rules are properly defined in schema
   - Check field names match between schema and data

3. **Form builder not saving**
   - Verify user has proper permissions
   - Check network tab for API errors
   - Ensure instance_id is being passed

### Debug Mode

Enable debug logging in form renderer:
```javascript
const formRenderer = new FormRenderer(schema, container, {
    debug: true
});
```

## Migration Guide

To add form builder to existing LOBs:

1. Run database migration:
   ```bash
   psql -U your_user -d your_db -f migrations/20240107_add_form_schemas.sql
   ```

2. Update existing LOBs through admin panel:
   - Navigate to Producer Admin
   - Click "Edit Form" button for each LOB
   - Design and save custom forms

3. Test with a producer account to ensure forms render correctly

## Security Considerations

1. **Input Validation**
   - All form inputs are validated on both client and server
   - Schema structure is validated before storage
   - SQL injection prevention through parameterized queries

2. **Access Control**
   - Form schemas are instance-specific
   - Producers can only access forms for approved LOBs
   - Admins can only modify forms for their instance

3. **Data Protection**
   - Form data is stored in JSONB format
   - Sensitive fields can be marked for encryption (future enhancement)
   - Audit trail for form modifications

## Support

For issues or questions:
1. Check browser console for errors
2. Review API response in network tab
3. Verify database schema is up to date
4. Contact system administrator for assistance