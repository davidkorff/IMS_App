const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    password: 'D040294k',
    host: process.platform === 'win32' ? 'localhost' : '172.17.224.1',
    port: 5432,
    database: 'IMS_Application'
});

async function debugFormBuilderLoad() {
    try {
        console.log('Debug: Form Builder Loading Issue\n');
        
        // 1. Get the form_schema_id from LOB 4
        const lobCheck = await pool.query(`
            SELECT 
                lob_id,
                line_name,
                form_schema_id
            FROM portal_lines_of_business 
            WHERE lob_id = 4
        `);
        
        if (lobCheck.rows.length === 0) {
            console.log('❌ LOB 4 not found!');
            process.exit(1);
        }
        
        const lob = lobCheck.rows[0];
        console.log('LOB Info:');
        console.log(`- ID: ${lob.lob_id}`);
        console.log(`- Name: ${lob.line_name}`);
        console.log(`- Form Schema ID: ${lob.form_schema_id || 'NOT SET'}`);
        
        if (!lob.form_schema_id) {
            console.log('\n❌ LOB does not have a form_schema_id set!');
            console.log('This is why the form builder appears empty.');
            
            // Check if there's a form schema for this LOB
            const formCheck = await pool.query(`
                SELECT form_id, title, created_at
                FROM form_schemas 
                WHERE lob_id = 4 AND instance_id = 4
                ORDER BY created_at DESC
            `);
            
            if (formCheck.rows.length > 0) {
                console.log('\n✅ Found form schema(s) for this LOB:');
                formCheck.rows.forEach(form => {
                    console.log(`   - ${form.form_id} (${form.title})`);
                });
                
                console.log('\n🔧 FIX: Update the LOB to link to the form:');
                console.log(`UPDATE portal_lines_of_business SET form_schema_id = '${formCheck.rows[0].form_id}' WHERE lob_id = 4;`);
            }
        } else {
            // Check if the form_schema exists
            const formCheck = await pool.query(`
                SELECT 
                    form_id,
                    title,
                    jsonb_array_length(form_schema -> 'pages') as page_count,
                    created_at
                FROM form_schemas 
                WHERE form_id = $1
            `, [lob.form_schema_id]);
            
            if (formCheck.rows.length === 0) {
                console.log(`\n❌ Form schema ${lob.form_schema_id} not found!`);
                console.log('The LOB references a form that doesn\'t exist.');
            } else {
                const form = formCheck.rows[0];
                console.log('\n✅ Form schema exists:');
                console.log(`- Form ID: ${form.form_id}`);
                console.log(`- Title: ${form.title}`);
                console.log(`- Pages: ${form.page_count}`);
                console.log(`- Created: ${form.created_at}`);
                
                console.log('\n🔍 The form exists and is linked properly.');
                console.log('The issue might be:');
                console.log('1. JavaScript timing issue when loading the form');
                console.log('2. Form builder window not fully loaded');
                console.log('3. API endpoint not returning data correctly');
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugFormBuilderLoad();