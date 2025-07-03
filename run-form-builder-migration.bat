@echo off
echo Running Form Builder Migration...
echo.

REM Change to the directory containing the script
cd /d "%~dp0"

REM Check if node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Run the Windows version of the migration script
echo Starting migration...
node run-form-builder-migration-windows.js

echo.
echo Migration process completed!
echo.
echo If you see any errors above, you can also run the migration manually:
echo 1. Open pgAdmin or psql
echo 2. Connect to your IMS_Application database
echo 3. Run the SQL file: migrations\20240107_add_form_schemas.sql
echo.
pause