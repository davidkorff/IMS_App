# Form Builder Testing Guide

## Issue Fixed
The drag-and-drop functionality has been fixed by:
1. Removing conflicting native HTML5 drag events
2. Properly configuring Sortable.js with clone functionality
3. Setting up correct group configurations for source (palette) and target (sections)

## Testing Steps

### 1. Access Form Builder
- Go to Producer Admin page
- Click on "Lines of Business" tab
- Click the "Edit Form" button (📝) for any LOB
- OR click "Advanced Form Builder" when creating a new LOB

### 2. Test Drag and Drop
- Try dragging fields from the left palette into the section
- Fields should clone (original stays in palette)
- You should be able to:
  - Add multiple fields
  - Reorder fields within a section
  - Delete fields with the trash icon
  - Duplicate fields with the copy icon

### 3. Test Field Properties
- Click on any field in the form
- Properties panel on the right should show
- Try changing:
  - Field Label
  - Required status
  - Placeholder text
  - Options (for dropdowns/radio/checkboxes)

### 4. Test Form Saving
- Click "Save" button in top navigation
- Form schema is saved to database in `form_schemas` table
- Schema is automatically linked to the LOB if opened from LOB edit

### 5. Test Form Rendering
- Create a new producer submission for the LOB
- The custom form should render instead of default form
- All field types should work correctly

## Database Storage

Yes, forms are stored in the database:

```sql
-- Form schemas table
form_schemas (
    form_id UUID PRIMARY KEY,
    instance_id INTEGER,
    lob_id UUID,
    title VARCHAR(255),
    description TEXT,
    form_schema JSONB,  -- This stores the complete form object
    is_active BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Form submissions table  
form_submissions (
    submission_id UUID PRIMARY KEY,
    form_id UUID,
    form_data JSONB,  -- Stores submitted data
    form_state JSONB, -- Stores draft state
    is_draft BOOLEAN
)
```

## Troubleshooting

If drag-drop still doesn't work:
1. Check browser console for errors
2. Ensure Sortable.js is loaded (check network tab)
3. Try refreshing the page
4. Make sure you're dragging onto the section area (not the section header)

## Form Object Structure

The form object stored in the database contains:
- **metadata**: Form title, description, timestamps
- **pages**: Array of pages with sections
- **fields**: Object with all field definitions
- **logic**: Conditional rules (future enhancement)
- **calculations**: Calculation rules (future enhancement)
- **settings**: Form behavior settings

Example query to see stored forms:
```sql
SELECT 
    form_id,
    title,
    jsonb_pretty(form_schema) as schema
FROM form_schemas
WHERE instance_id = [your_instance_id];
```