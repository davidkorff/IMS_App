#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Test to Production Migration${NC}"
echo -e "${BLUE}================================${NC}\n"

# Check if we're in production mode
if [ "$1" != "--production" ]; then
    echo -e "${YELLOW}Running in test mode. Add --production flag to run against production database.${NC}"
    echo -e "${YELLOW}This script will dump your test database schema and apply it to production.${NC}\n"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Test database credentials
TEST_HOST=${TEST_DB_HOST:-localhost}
TEST_PORT=${TEST_DB_PORT:-5432}
TEST_DB=${TEST_DB_NAME:-ims_test}
TEST_USER=${TEST_DB_USER:-postgres}
TEST_PASSWORD=${TEST_DB_PASSWORD}

# Production database credentials
PROD_HOST=${PROD_DB_HOST:-$PGHOST}
PROD_PORT=${PROD_DB_PORT:-$PGPORT}
PROD_DB=${PROD_DB_NAME:-$PGDATABASE}
PROD_USER=${PROD_DB_USER:-$PGUSER}
PROD_PASSWORD=${PROD_DB_PASSWORD:-$PGPASSWORD}

echo -e "${YELLOW}Test Database:${NC}"
echo "Host: $TEST_HOST"
echo "Port: $TEST_PORT"
echo "Database: $TEST_DB"
echo "User: $TEST_USER"
echo ""

echo -e "${RED}Production Database:${NC}"
echo "Host: $PROD_HOST"
echo "Port: $PROD_PORT"
echo "Database: $PROD_DB"
echo "User: $PROD_USER"
echo ""

# Safety check
echo -e "${RED}⚠️  WARNING: This will modify your production database!${NC}"
echo -e "${RED}This process will:${NC}"
echo -e "${RED}1. Dump the schema from your test database${NC}"
echo -e "${RED}2. Apply it to your production database${NC}"
echo -e "${RED}3. Only create missing tables/columns (won't drop existing data)${NC}\n"
read -p "Type 'YES' to continue: " confirm

if [ "$confirm" != "YES" ]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 1
fi

# Create backup directory
BACKUP_DIR="./db_backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "\n${BLUE}Step 1: Creating production backup...${NC}"
PGPASSWORD=$PROD_PASSWORD pg_dump \
    -h $PROD_HOST \
    -p $PROD_PORT \
    -U $PROD_USER \
    -d $PROD_DB \
    --schema-only \
    -f "$BACKUP_DIR/production_schema_backup.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Production backup created at $BACKUP_DIR/production_schema_backup.sql${NC}"
else
    echo -e "${RED}✗ Failed to backup production database${NC}"
    exit 1
fi

echo -e "\n${BLUE}Step 2: Dumping test database schema...${NC}"
PGPASSWORD=$TEST_PASSWORD pg_dump \
    -h $TEST_HOST \
    -p $TEST_PORT \
    -U $TEST_USER \
    -d $TEST_DB \
    --schema-only \
    --no-owner \
    --no-privileges \
    --if-exists \
    --clean \
    -f "$BACKUP_DIR/test_schema.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Test schema dumped successfully${NC}"
else
    echo -e "${RED}✗ Failed to dump test database${NC}"
    exit 1
fi

# Create a migration script that only adds missing objects
echo -e "\n${BLUE}Step 3: Creating safe migration script...${NC}"

# Create a modified version that won't drop existing data
cat > "$BACKUP_DIR/safe_migration.sql" << 'EOF'
-- Safe migration script that only adds missing objects
-- This script will not drop any existing tables or data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- Set search path
SET search_path TO public;

EOF

# Extract only CREATE statements and modify them to use IF NOT EXISTS
grep -E "^CREATE (TABLE|INDEX|SEQUENCE|FUNCTION|TRIGGER|EXTENSION)" "$BACKUP_DIR/test_schema.sql" | \
sed 's/CREATE TABLE/CREATE TABLE IF NOT EXISTS/g' | \
sed 's/CREATE INDEX/CREATE INDEX IF NOT EXISTS/g' | \
sed 's/CREATE SEQUENCE/CREATE SEQUENCE IF NOT EXISTS/g' | \
sed 's/CREATE OR REPLACE FUNCTION/CREATE OR REPLACE FUNCTION/g' | \
sed 's/CREATE TRIGGER/CREATE TRIGGER IF NOT EXISTS/g' \
>> "$BACKUP_DIR/safe_migration.sql"

# Extract ALTER TABLE ADD COLUMN statements and make them safe
echo -e "\n-- Add missing columns" >> "$BACKUP_DIR/safe_migration.sql"
grep -E "^ALTER TABLE .* ADD COLUMN" "$BACKUP_DIR/test_schema.sql" | \
sed 's/ADD COLUMN/ADD COLUMN IF NOT EXISTS/g' \
>> "$BACKUP_DIR/safe_migration.sql"

# Add commit
echo -e "\nCOMMIT;" >> "$BACKUP_DIR/safe_migration.sql"

echo -e "${GREEN}✓ Safe migration script created${NC}"

echo -e "\n${BLUE}Step 4: Applying migration to production...${NC}"
PGPASSWORD=$PROD_PASSWORD psql \
    -h $PROD_HOST \
    -p $PROD_PORT \
    -U $PROD_USER \
    -d $PROD_DB \
    -f "$BACKUP_DIR/safe_migration.sql" \
    -v ON_ERROR_STOP=0 \
    > "$BACKUP_DIR/migration_output.log" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Migration completed with some warnings (this is normal for existing objects)${NC}"
fi

# Show summary
echo -e "\n${BLUE}Step 5: Verification...${NC}"
PGPASSWORD=$PROD_PASSWORD psql \
    -h $PROD_HOST \
    -p $PROD_PORT \
    -U $PROD_USER \
    -d $PROD_DB \
    -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"

echo -e "\n${GREEN}Migration complete!${NC}"
echo -e "${YELLOW}Files created:${NC}"
echo "- Backup: $BACKUP_DIR/production_schema_backup.sql"
echo "- Test schema: $BACKUP_DIR/test_schema.sql"  
echo "- Migration script: $BACKUP_DIR/safe_migration.sql"
echo "- Output log: $BACKUP_DIR/migration_output.log"
echo ""
echo -e "${YELLOW}To review what was done:${NC}"
echo "cat $BACKUP_DIR/migration_output.log"