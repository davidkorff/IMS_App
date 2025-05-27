// Database investigation script to find document storage issues
const pool = require('./config/db');

async function investigateDatabase() {
    console.log('🔍 Investigating Database for Document Storage...\n');
    
    try {
        // 1. List all tables
        console.log('📋 Step 1: Getting all tables...');
        const tablesResult = await pool.query(`
            SELECT table_name, table_schema
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_name
        `);
        
        console.log('📋 All tables in database:');
        tablesResult.rows.forEach(row => {
            console.log(`   - ${row.table_name} (${row.table_schema})`);
        });
        
        // 2. Find document-related tables
        console.log('\n📄 Step 2: Finding document-related tables...');
        const docTablesResult = await pool.query(`
            SELECT table_name, table_schema
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
              AND (
                table_name ILIKE '%doc%' OR 
                table_name ILIKE '%file%' OR 
                table_name ILIKE '%attach%' OR
                table_name ILIKE '%folder%' OR
                table_name ILIKE '%content%'
              )
            ORDER BY table_name
        `);
        
        console.log('📄 Document-related tables:');
        if (docTablesResult.rows.length === 0) {
            console.log('   ❌ No obvious document tables found');
        } else {
            docTablesResult.rows.forEach(row => {
                console.log(`   - ${row.table_name}`);
            });
        }
        
        // 3. Check our known tables
        console.log('\n📊 Step 3: Checking known tables for recent activity...');
        
        const knownTables = ['email_filing_logs', 'usage_events', 'email_filing_configs'];
        
        for (const tableName of knownTables) {
            try {
                const recentResult = await pool.query(`
                    SELECT COUNT(*) as count, MAX(created_at) as latest
                    FROM ${tableName} 
                    WHERE created_at > NOW() - INTERVAL '1 hour'
                `);
                
                const latest = recentResult.rows[0].latest;
                const count = recentResult.rows[0].count;
                
                console.log(`   📋 ${tableName}: ${count} recent entries (latest: ${latest || 'none'})`);
                
                if (count > 0) {
                    const recentEntries = await pool.query(`
                        SELECT * FROM ${tableName} 
                        WHERE created_at > NOW() - INTERVAL '1 hour'
                        ORDER BY created_at DESC
                        LIMIT 3
                    `);
                    
                    console.log(`   📋 Recent ${tableName} entries:`);
                    recentEntries.rows.forEach((row, index) => {
                        console.log(`      ${index + 1}:`, JSON.stringify(row, null, 2));
                    });
                }
                
            } catch (error) {
                console.log(`   ❌ Error checking ${tableName}:`, error.message);
            }
        }
        
        // 4. Search for our test GUIDs across all text columns
        console.log('\n🔍 Step 4: Searching for our test document GUIDs...');
        
        const testGUIDs = [
            '38370ea0-c2fd-42c7-a246-3381032a5770',
            'ac8be2f6-91c3-4d3b-8839-4133fc45c3f8'
        ];
        
        // Get all text/varchar columns
        const columnsResult = await pool.query(`
            SELECT 
                table_name,
                column_name,
                data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type IN ('text', 'varchar', 'character varying', 'uuid')
            ORDER BY table_name, column_name
        `);
        
        console.log(`📋 Found ${columnsResult.rows.length} text/varchar/uuid columns to search`);
        
        for (const guid of testGUIDs) {
            console.log(`\n🔍 Searching for GUID: ${guid}`);
            let foundAnywhere = false;
            
            for (const col of columnsResult.rows) {
                try {
                    const searchResult = await pool.query(
                        `SELECT COUNT(*) as count FROM ${col.table_name} WHERE ${col.column_name}::text = $1`,
                        [guid]
                    );
                    
                    if (parseInt(searchResult.rows[0].count) > 0) {
                        console.log(`   ✅ Found in ${col.table_name}.${col.column_name}!`);
                        foundAnywhere = true;
                        
                        // Get the actual records
                        const records = await pool.query(
                            `SELECT * FROM ${col.table_name} WHERE ${col.column_name}::text = $1`,
                            [guid]
                        );
                        
                        console.log(`   📋 Record details:`);
                        records.rows.forEach(record => {
                            console.log('      ', JSON.stringify(record, null, 2));
                        });
                    }
                } catch (searchError) {
                    // Skip columns that can't be searched (some might have constraints)
                }
            }
            
            if (!foundAnywhere) {
                console.log(`   ❌ GUID ${guid} not found in any database table!`);
                console.log(`   ⚠️  This suggests documents aren't being stored in our local database`);
                console.log(`   💡 They're likely only in the IMS system`);
            }
        }
        
        // 5. Check table structures of any promising tables
        console.log('\n📋 Step 5: Examining table structures...');
        
        const allTables = tablesResult.rows.map(r => r.table_name);
        const interestingTables = allTables.filter(name => 
            name.includes('doc') || 
            name.includes('file') || 
            name.includes('attach') ||
            name.includes('email') ||
            name.includes('content')
        );
        
        if (interestingTables.length === 0) {
            console.log('❌ No obviously relevant tables found');
            console.log('💡 This confirms documents are stored in IMS, not locally');
        } else {
            for (const tableName of interestingTables.slice(0, 3)) { // Limit to first 3
                try {
                    const schemaResult = await pool.query(`
                        SELECT 
                            column_name,
                            data_type,
                            is_nullable,
                            column_default
                        FROM information_schema.columns
                        WHERE table_name = $1
                        ORDER BY ordinal_position
                    `, [tableName]);
                    
                    console.log(`\n📋 Table structure: ${tableName}`);
                    schemaResult.rows.forEach(col => {
                        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
                    });
                    
                } catch (error) {
                    console.log(`   ❌ Error getting schema for ${tableName}`);
                }
            }
        }
        
        console.log('\n🎯 INVESTIGATION SUMMARY:');
        console.log('1. Check above results for any tables containing our test GUIDs');
        console.log('2. If GUIDs not found locally, documents are only in IMS system');
        console.log('3. Visibility issue is likely in IMS configuration, not our code');
        console.log('4. May need to check IMS folder permissions, document types, or UI filters');
        
    } catch (error) {
        console.error('❌ Database investigation failed:', error);
    } finally {
        await pool.end();
    }
}

investigateDatabase();