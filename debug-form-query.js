const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    password: 'D040294k',
    host: process.platform === 'win32' ? 'localhost' : '172.17.224.1',
    port: 5432,
    database: 'IMS_Application'
});

async function debugFormQuery() {
    try {
        console.log('Debug: Form Query Issue\n');
        
        const formId = 'a1715135-94dc-456a-a68a-982ab0ed0fe1';
        const instanceId = 4;
        
        // 1. Check if form exists at all
        console.log('1. Checking if form exists in database:');
        const formExists = await pool.query(`
            SELECT form_id, instance_id, lob_id, title 
            FROM form_schemas 
            WHERE form_id = $1
        `, [formId]);
        
        if (formExists.rows.length > 0) {
            console.log('✅ Form found:');
            console.log('  - form_id:', formExists.rows[0].form_id);
            console.log('  - instance_id:', formExists.rows[0].instance_id);
            console.log('  - lob_id:', formExists.rows[0].lob_id);
            console.log('  - title:', formExists.rows[0].title);
        } else {
            console.log('❌ Form not found with this ID!');
        }
        
        // 2. Check the exact query the API is using
        console.log('\n2. Testing API query:');
        const apiQuery = await pool.query(`
            SELECT * FROM form_schemas 
            WHERE form_id = $1 AND instance_id = $2
        `, [formId, instanceId]);
        
        console.log('API query result rows:', apiQuery.rows.length);
        
        if (apiQuery.rows.length === 0) {
            console.log('❌ API query returns no results');
            console.log('   This means either:');
            console.log('   - The form_id is wrong');
            console.log('   - The instance_id is wrong');
            console.log('   - The form exists but with a different instance_id');
        }
        
        // 3. Check what instance_id the form actually has
        console.log('\n3. Checking actual form data:');
        const actualForm = await pool.query(`
            SELECT 
                form_id,
                instance_id,
                lob_id,
                title,
                created_at
            FROM form_schemas 
            WHERE form_id = $1
        `, [formId]);
        
        if (actualForm.rows.length > 0) {
            const form = actualForm.rows[0];
            console.log('Form details:');
            console.log('  - form_id:', form.form_id);
            console.log('  - instance_id:', form.instance_id, '(expected:', instanceId + ')');
            console.log('  - lob_id:', form.lob_id);
            console.log('  - title:', form.title);
            console.log('  - created_at:', form.created_at);
            
            if (form.instance_id !== instanceId) {
                console.log('\n⚠️  INSTANCE_ID MISMATCH!');
                console.log('The form exists but with instance_id:', form.instance_id);
                console.log('The API is looking for instance_id:', instanceId);
            }
        }
        
        // 4. Check user's instance_id
        console.log('\n4. Checking user authentication:');
        // In the API, it uses req.user.instance_id
        // Let's see what instance_id the user might have
        const users = await pool.query(`
            SELECT user_id, username, instance_id 
            FROM users 
            WHERE username IN ('david', 'admin')
        `);
        
        console.log('User instance IDs:');
        users.rows.forEach(user => {
            console.log(`  - ${user.username}: instance_id = ${user.instance_id}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugFormQuery();