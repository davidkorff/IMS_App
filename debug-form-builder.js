const pool = require('./config/db');

async function debugFormBuilder() {
    try {
        console.log('Debugging Form Builder Issue...\n');
        
        // 1. Check what's in form_schemas
        console.log('1. Checking form_schemas table:');
        console.log('===============================');
        const formSchemas = await pool.query(`
            SELECT 
                form_id,
                instance_id,
                lob_id,
                title,
                is_active,
                created_at,
                LENGTH(form_schema::text) as schema_size
            FROM form_schemas 
            WHERE instance_id = 4
            ORDER BY created_at DESC
        `);
        
        console.log(`Found ${formSchemas.rows.length} form schemas:`);
        formSchemas.rows.forEach(form => {
            console.log(`\n- Form ID: ${form.form_id}`);
            console.log(`  Title: ${form.title}`);
            console.log(`  LOB ID: ${form.lob_id}`);
            console.log(`  Active: ${form.is_active}`);
            console.log(`  Schema Size: ${form.schema_size} bytes`);
        });
        
        // 2. Check LOB linkage
        console.log('\n\n2. Checking LOB linkage:');
        console.log('========================');
        const lobCheck = await pool.query(`
            SELECT 
                l.lob_id,
                l.line_name,
                l.form_schema_id,
                f.form_id,
                f.title as form_title
            FROM portal_lines_of_business l
            LEFT JOIN form_schemas f ON l.form_schema_id = f.form_id
            WHERE l.instance_id = 4
        `);
        
        lobCheck.rows.forEach(lob => {
            console.log(`\nLOB: ${lob.line_name} (ID: ${lob.lob_id})`);
            console.log(`Form Schema ID in LOB: ${lob.form_schema_id || 'NULL'}`);
            console.log(`Linked Form: ${lob.form_title || 'None'}`);
        });
        
        // 3. Get the actual form schema for LOB 4
        console.log('\n\n3. Checking form schema content:');
        console.log('================================');
        const formContent = await pool.query(`
            SELECT 
                form_id,
                form_schema->'id' as schema_id,
                form_schema->'metadata'->>'title' as metadata_title,
                jsonb_array_length(form_schema->'pages') as page_count,
                form_schema->'pages'->0->>'title' as first_page_title
            FROM form_schemas 
            WHERE lob_id = 4 
            AND instance_id = 4
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (formContent.rows.length > 0) {
            const content = formContent.rows[0];
            console.log(`Form ID: ${content.form_id}`);
            console.log(`Schema ID: ${content.schema_id}`);
            console.log(`Title: ${content.metadata_title}`);
            console.log(`Pages: ${content.page_count}`);
            console.log(`First Page: ${content.first_page_title}`);
        } else {
            console.log('No form schema found for LOB 4!');
        }
        
        // 4. Check if there's a mismatch
        console.log('\n\n4. Checking for UUID format issues:');
        console.log('===================================');
        const uuidCheck = await pool.query(`
            SELECT 
                l.lob_id,
                l.form_schema_id as lob_form_id,
                f.form_id as actual_form_id,
                l.form_schema_id = f.form_id as ids_match,
                pg_typeof(l.form_schema_id) as lob_type,
                pg_typeof(f.form_id) as form_type
            FROM portal_lines_of_business l
            LEFT JOIN form_schemas f ON f.lob_id = l.lob_id AND f.instance_id = l.instance_id
            WHERE l.lob_id = 4
        `);
        
        if (uuidCheck.rows.length > 0) {
            const check = uuidCheck.rows[0];
            console.log(`LOB form_schema_id: ${check.lob_form_id}`);
            console.log(`Actual form_id: ${check.actual_form_id}`);
            console.log(`IDs match: ${check.ids_match}`);
            console.log(`LOB ID type: ${check.lob_type}`);
            console.log(`Form ID type: ${check.form_type}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugFormBuilder();