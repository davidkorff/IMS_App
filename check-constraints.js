const pool = require('./config/db');

async function checkConstraints() {
    try {
        console.log('Checking email_configurations table constraints...');
        
        // Check table constraints
        const constraints = await pool.query(`
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                tc.table_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'email_configurations'
            AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
            ORDER BY tc.constraint_type, tc.constraint_name;
        `);
        
        console.log('Constraints found:');
        constraints.rows.forEach(row => {
            console.log(`- ${row.constraint_name} (${row.constraint_type}): ${row.column_name}`);
        });
        
        // Check table structure
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'email_configurations'
            ORDER BY ordinal_position;
        `);
        
        console.log('\nTable structure:');
        columns.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        pool.end();
    }
}

checkConstraints();