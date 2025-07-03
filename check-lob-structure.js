const pool = require('./config/db');

async function checkLOBStructure() {
    try {
        console.log('Checking portal_lines_of_business table structure...\n');
        
        // Check if table exists
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'portal_lines_of_business'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ Table portal_lines_of_business does not exist!');
            process.exit(1);
        }
        
        // Get column information
        const columns = await pool.query(`
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'portal_lines_of_business'
            ORDER BY ordinal_position;
        `);
        
        console.log('portal_lines_of_business columns:');
        console.log('================================');
        columns.rows.forEach(col => {
            console.log(`${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });
        
        // Check specifically for lob_id
        const lobIdColumn = columns.rows.find(col => col.column_name === 'lob_id');
        if (lobIdColumn) {
            console.log(`\n✅ lob_id column exists with type: ${lobIdColumn.data_type}`);
            if (lobIdColumn.data_type !== 'uuid') {
                console.log(`⚠️  Warning: lob_id is ${lobIdColumn.data_type}, not UUID as expected!`);
            }
        } else {
            console.log('\n❌ lob_id column not found!');
        }
        
        // Check constraints
        const constraints = await pool.query(`
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'portal_lines_of_business'
            ORDER BY tc.constraint_type, tc.constraint_name;
        `);
        
        console.log('\nConstraints:');
        console.log('============');
        constraints.rows.forEach(con => {
            console.log(`${con.constraint_type}: ${con.constraint_name} on ${con.column_name}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkLOBStructure();