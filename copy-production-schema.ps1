# Production database connection (Render)
$env:PGPASSWORD="463KnHH7jF0ywT99idxvTg0kenhqyNnU"

# Export schema from production
Write-Host "🔄 Exporting schema from production database..." -ForegroundColor Cyan
pg_dump -h dpg-d0on2rje5dus73d1ivd0-a.oregon-postgres.render.com -U ims_db_6zj4_user -d ims_db_6zj4 --schema-only --no-owner --no-privileges --no-comments > production_schema.sql

Write-Host "✅ Schema exported to production_schema.sql" -ForegroundColor Green

# Now you need to update your local database connection in the .env file
Write-Host "`n📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Update your .env file with your local database connection"
Write-Host "2. Import the schema to your local database:"
Write-Host "   psql -h localhost -U postgres -d YOUR_LOCAL_DB < production_schema.sql" -ForegroundColor White