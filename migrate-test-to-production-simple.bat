@echo off
REM Simple Windows batch script to dump test DB schema and apply to production

echo ================================
echo Test to Production Migration
echo ================================
echo.

REM Check for production flag
if "%1" NEQ "--production" (
    echo Running in test mode. Add --production flag to run against production database.
    echo This script will dump your test database schema and apply it to production.
    exit /b 1
)

REM Load environment variables from .env.ims file
if exist .env.ims (
    for /f "tokens=1,2 delims==" %%a in (.env.ims) do (
        set %%a=%%b
    )
)

REM Create timestamp for backup
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set datetime=%%a
set timestamp=%datetime:~0,8%_%datetime:~8,6%

REM Create backup directory
set BACKUP_DIR=db_backups\%timestamp%
mkdir %BACKUP_DIR% 2>nul

echo.
echo WARNING: This will modify your production database!
echo.
set /p confirm="Type 'YES' to continue: "
if /i "%confirm%" NEQ "YES" (
    echo Migration cancelled.
    exit /b 1
)

echo.
echo Step 1: Dumping test database schema...
set PGPASSWORD=%TEST_DB_PASSWORD%
pg_dump -h %TEST_DB_HOST% -p %TEST_DB_PORT% -U %TEST_DB_USER% -d %TEST_DB_NAME% --schema-only --no-owner --no-privileges -f "%BACKUP_DIR%\test_schema_full.sql"

if %errorlevel% neq 0 (
    echo Failed to dump test database
    exit /b 1
)
echo Test schema dumped successfully

echo.
echo Step 2: Creating migration script with latest migrations...

REM Create the final migration SQL with all latest migrations
echo -- Production Migration Script > "%BACKUP_DIR%\production_migration.sql"
echo -- Generated from test database >> "%BACKUP_DIR%\production_migration.sql"
echo -- Includes migrations 020 and 021 >> "%BACKUP_DIR%\production_migration.sql"
echo. >> "%BACKUP_DIR%\production_migration.sql"
echo CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; >> "%BACKUP_DIR%\production_migration.sql"
echo. >> "%BACKUP_DIR%\production_migration.sql"

REM Add the test schema
type "%BACKUP_DIR%\test_schema_full.sql" >> "%BACKUP_DIR%\production_migration.sql"

REM Add migration 020 if it exists
if exist migrations\020_excel_premium_mappings.sql (
    echo. >> "%BACKUP_DIR%\production_migration.sql"
    echo -- Migration 020: Excel Premium Mappings >> "%BACKUP_DIR%\production_migration.sql"
    type migrations\020_excel_premium_mappings.sql >> "%BACKUP_DIR%\production_migration.sql"
)

REM Add migration 021 if it exists  
if exist migrations\021_update_formula_calc_methods.sql (
    echo. >> "%BACKUP_DIR%\production_migration.sql"
    echo -- Migration 021: Update Formula Calc Methods >> "%BACKUP_DIR%\production_migration.sql"
    type migrations\021_update_formula_calc_methods.sql >> "%BACKUP_DIR%\production_migration.sql"
)

echo.
echo Step 3: Applying to production database...
set PGPASSWORD=%PGPASSWORD%
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f "%BACKUP_DIR%\production_migration.sql" -v ON_ERROR_STOP=OFF > "%BACKUP_DIR%\migration_output.log" 2>&1

echo.
echo Migration complete!
echo.
echo Files created:
echo - Full migration: %BACKUP_DIR%\production_migration.sql
echo - Output log: %BACKUP_DIR%\migration_output.log
echo.
echo To see what happened:
echo type %BACKUP_DIR%\migration_output.log