#!/bin/bash

# Production database connection (Render)
PROD_HOST="dpg-d0on2rje5dus73d1ivd0-a.oregon-postgres.render.com"
PROD_USER="ims_db_6zj4_user"
PROD_PASS="463KnHH7jF0ywT99idxvTg0kenhqyNnU"
PROD_DB="ims_db_6zj4"

# Local database connection - update these with your local details
LOCAL_HOST="localhost"
LOCAL_USER="postgres"
LOCAL_DB="ims_local"  # Change this to your local database name

echo "🔄 Exporting schema from production database..."
PGPASSWORD=$PROD_PASS pg_dump -h $PROD_HOST -U $PROD_USER -d $PROD_DB --schema-only --no-owner --no-privileges --no-comments > production_schema.sql

echo "✅ Schema exported to production_schema.sql"
echo "📊 File size: $(ls -lh production_schema.sql | awk '{print $5}')"

echo ""
echo "Now import to your local database with:"
echo "psql -h $LOCAL_HOST -U $LOCAL_USER -d $LOCAL_DB < production_schema.sql"