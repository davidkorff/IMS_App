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
- **Complex**: address, location, repeater, grid
- **Display**: heading, paragraph, divider, html

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