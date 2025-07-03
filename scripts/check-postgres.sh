#!/bin/bash

echo "Checking PostgreSQL status..."

# Check if PostgreSQL service is running (Windows WSL)
if command -v pg_ctl &> /dev/null; then
    echo "PostgreSQL command found"
else
    echo "❌ PostgreSQL not found. You need to install PostgreSQL"
    echo "Run: sudo apt update && sudo apt install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL is running
if sudo service postgresql status | grep -q "online"; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not running"
    echo "Starting PostgreSQL..."
    sudo service postgresql start
    
    # Check again
    if sudo service postgresql status | grep -q "online"; then
        echo "✅ PostgreSQL started successfully"
    else
        echo "❌ Failed to start PostgreSQL"
        echo "Try: sudo service postgresql restart"
    fi
fi

# Test connection
echo -e "\nTesting database connection..."
PGPASSWORD=D040294k psql -U postgres -h localhost -p 5432 -d IMS_Application -c "SELECT 1;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "Possible issues:"
    echo "1. PostgreSQL is not running"
    echo "2. Database 'IMS_Application' doesn't exist"
    echo "3. Wrong password for postgres user"
    echo ""
    echo "To create the database:"
    echo "sudo -u postgres psql -c \"CREATE DATABASE \\\"IMS_Application\\\";\""
fi