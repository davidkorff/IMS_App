const pool = require('./config/db');

async function checkFormLoaded() {
    try {
        console.log('Checking if Workers Comp form was loaded...\n');
        
        // Check form schemas
        const formCheck = await pool.query(`
            SELECT 
                form_id,
                title,
                lob_id,
                created_at,
                jsonb_array_length(form_schema -> 'pages') as page_count,
                (SELECT COUNT(*) FROM jsonb_object_keys(form_schema -> 'fields')) as field_count
            FROM form_schemas 
            WHERE instance_id = 4 
            AND lob_id = 4
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (formCheck.rows.length > 0) {
            const form = formCheck.rows[0];
            console.log('✅ Form Schema Found!');
            console.log('====================');
            console.log(`Form ID: ${form.form_id}`);
            console.log(`Title: ${form.title}`);
            console.log(`Pages: ${form.page_count}`);
            console.log(`Fields: ${form.field_count}`);
            console.log(`Created: ${form.created_at}`);
        } else {
            console.log('❌ No form schema found for LOB 4');
        }
        
        // Check LOB linkage
        console.log('\nChecking LOB linkage...');
        const lobCheck = await pool.query(`
            SELECT 
                lob_id,
                line_name,
                form_schema_id
            FROM portal_lines_of_business 
            WHERE lob_id = 4
        `);
        
        if (lobCheck.rows.length > 0) {
            const lob = lobCheck.rows[0];
            console.log(`\nLOB: ${lob.line_name}`);
            console.log(`Form Schema ID: ${lob.form_schema_id || 'NOT SET'}`);
            
            if (lob.form_schema_id && formCheck.rows.length > 0) {
                if (lob.form_schema_id === formCheck.rows[0].form_id) {
                    console.log('✅ Form is properly linked to LOB!');
                } else {
                    console.log('⚠️  Form exists but is not linked to this LOB');
                }
            } else if (!lob.form_schema_id) {
                console.log('❌ LOB does not have a form_schema_id set');
            }
        }
        
        // Show sample fields
        if (formCheck.rows.length > 0) {
            console.log('\nSample fields in the form:');
            const fieldsCheck = await pool.query(`
                SELECT jsonb_object_keys(form_schema -> 'fields') as field_name
                FROM form_schemas 
                WHERE form_id = $1
                LIMIT 10
            `, [formCheck.rows[0].form_id]);
            
            fieldsCheck.rows.forEach(row => {
                console.log(`  - ${row.field_name}`);
            });
            console.log(`  ... and ${formCheck.rows[0].field_count - 10} more fields`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkFormLoaded();