# System Settings Management Tool Setup

This tool allows you to manage IMS system settings (tblSystemSettings) through a web interface with checkboxes for boolean values.

## Components Created

### 1. Web Interface
- **File**: `/public/system-settings.html`
- **Access**: Click "System Settings" tile from instance dashboard
- **Features**:
  - Toggle switches for boolean values (0/1)
  - Inline editing for string and numeric values
  - Search and filter functionality
  - Real-time updates with toast notifications

### 2. API Routes
- **File**: `/routes/webui/systemSettings.js`
- **Endpoints**:
  - GET `/api/webui/settings` - Fetch all settings
  - POST `/api/webui/settings/update` - Update a setting

### 3. Stored Procedures (for IMS SQL Server Database)
- **Files**: 
  - `/StoredProcs/DK_SystemSettings_GetAll_WS.sql`
  - `/StoredProcs/DK_SystemSettings_Update_WS.sql`

## Installation Steps

### Step 1: Deploy Stored Procedures to IMS Database

The stored procedures need to be deployed to your IMS SQL Server database, NOT the local PostgreSQL database.

#### Option A: Manual Deployment
1. Connect to your IMS SQL Server database using SQL Server Management Studio (SSMS)
2. Run the following scripts:
   - `/StoredProcs/DK_SystemSettings_GetAll_WS.sql`
   - `/StoredProcs/DK_SystemSettings_Update_WS.sql`

#### Option B: Using the Deployment Script
```bash
# Set environment variables
export IMS_DB_SERVER=your_server.database.windows.net
export IMS_DB_DATABASE=your_ims_database
export IMS_DB_USER=your_username
export IMS_DB_PASSWORD=your_password

# Run the deployment script
node deploy-system-settings-procs.js
```

### Step 2: Access the Tool

1. Start your application: `npm start`
2. Navigate to your instance dashboard
3. Click the "System Settings" tile
4. You can now view and edit system settings!

## Important Notes

- The migration file `013_system_settings_procedures.sql` is NOT for the local PostgreSQL database
- These stored procedures must be deployed to each IMS instance's SQL Server database
- The web interface uses the existing IMS web service authentication

## Usage

1. **Boolean Settings**: Click the toggle switch to change between True (1) and False (0)
2. **String Settings**: Click in the text field, edit, then click the save button
3. **Numeric Settings**: Click in the number field, edit, then click the save button
4. **Filtering**: Use the filter buttons to show only specific data types
5. **Search**: Use the search bar to find specific settings by name

## Troubleshooting

If you see "Failed to load settings":
1. Ensure the stored procedures are deployed to your IMS database
2. Check that your instance credentials are correct
3. Verify the IMS web services are accessible

## Files Created

- `/public/system-settings.html` - Web interface
- `/routes/webui/systemSettings.js` - API routes
- `/StoredProcs/DK_SystemSettings_GetAll_WS.sql` - Get all settings stored procedure
- `/StoredProcs/DK_SystemSettings_Update_WS.sql` - Update setting stored procedure
- `/deploy-system-settings-procs.js` - Deployment helper script
- `/migrations/013_system_settings_procedures.sql` - Combined SQL script (for SQL Server only)