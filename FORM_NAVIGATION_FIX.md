# Form Navigation Fix

## Issue Description
Forms were rendering all pages on a single page instead of showing them separately with navigation buttons. This was particularly noticed with LOB ID 18 forms where "Basic Information" and "Page 2" were appearing together.

## Root Cause
The issue was caused by missing `navigation` properties on form pages. The form renderer (`form-renderer.js`) checks for `page.navigation.showNext` and `page.navigation.showPrevious` to render navigation buttons. Without these properties, no navigation buttons were rendered, effectively showing all content on one page.

## Files Modified

### 1. `/public/js/form-builder.js`
- Added `navigation` property to the default page template in `formSchema`
- Added `navigation` property to new pages created via `addPage()`
- Updated `loadFormSchema()` to add navigation properties to existing pages for backward compatibility

### 2. `/public/js/form-renderer.js`
- Modified `renderNavigation()` to handle missing navigation properties gracefully
- Added default navigation settings when `page.navigation` is undefined

## Migration Script
Created `fix-form-navigation.js` to update existing form schemas in the database:
- Adds navigation properties to all pages that are missing them
- Specifically checks LOB 18 status
- Run with: `node fix-form-navigation.js`

## Navigation Property Structure
```javascript
navigation: {
    showPrevious: true,    // Show "Back" button (false for first page)
    showNext: true,        // Show "Continue" button
    showSave: true,        // Show "Save Draft" button
    nextButtonText: 'Continue',
    previousButtonText: 'Back'
}
```

## Testing
1. Create a new form - should have navigation buttons by default
2. Load an existing form - should automatically add navigation properties
3. Navigate between pages using Continue/Back buttons
4. Verify only one page shows at a time

## Impact
- All new forms will have proper page navigation
- Existing forms will be automatically fixed when loaded in the form builder
- The form renderer will handle missing navigation properties gracefully