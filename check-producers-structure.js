const pool = require('./config/db');

async function checkProducersStructure() {
    try {
        console.log('Checking producers and producer_submissions table structures...\n');
        
        // Check producers table
        const producersExists = await pool.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'producers'
            );
        `);
        
        if (producersExists.rows[0].exists) {
            console.log('producers table:');
            console.log('================');
            
            const producerColumns = await pool.query(`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns
                WHERE table_name = 'producers'
                AND column_name IN ('producer_id', 'id')
                ORDER BY ordinal_position;
            `);
            
            producerColumns.rows.forEach(col => {
                console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
            });
        } else {
            console.log('❌ producers table does not exist');
        }
        
        // Check producer_submissions table
        const submissionsExists = await pool.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'producer_submissions'
            );
        `);
        
        if (submissionsExists.rows[0].exists) {
            console.log('\n\nproducer_submissions table:');
            console.log('===========================');
            
            const submissionColumns = await pool.query(`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns
                WHERE table_name = 'producer_submissions'
                AND column_name IN ('submission_guid', 'submission_id', 'producer_id')
                ORDER BY ordinal_position;
            `);
            
            submissionColumns.rows.forEach(col => {
                console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
            });
        } else {
            console.log('\n❌ producer_submissions table does not exist');
        }
        
        // Check what producer-related tables exist
        console.log('\n\nAll producer-related tables:');
        console.log('============================');
        
        const producerTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%producer%'
            ORDER BY table_name;
        `);
        
        producerTables.rows.forEach(table => {
            console.log(`- ${table.table_name}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkProducersStructure();