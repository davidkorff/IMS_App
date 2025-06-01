const pool = require('./config/db');
const dataAccess = require('./services/dataAccess');

async function testFormsAPI() {
    console.log('Starting Forms API Test...\n');
    
    try {
        // Test 1: Check database connection
        console.log('1. Testing database connection...');
        const testQuery = await pool.query('SELECT 1 as test');
        console.log('✓ Database connected successfully\n');
        
        // Test 2: Check IMS instance
        console.log('2. Checking IMS instance...');
        const instance = await pool.query(
            'SELECT * FROM ims_instances WHERE instance_id = $1',
            [3] // Using instance_id = 3 as in your URL
        );
        
        if (instance.rows.length === 0) {
            console.log('✗ Instance not found!');
            return;
        }
        
        console.log('✓ Instance found:', {
            name: instance.rows[0].name,
            url: instance.rows[0].url,
            username: instance.rows[0].username
        });
        console.log('');
        
        // Test 3: Test stored procedures
        console.log('3. Testing stored procedures...\n');
        
        // Test DK_GetCompanies_WS
        console.log('Testing DK_GetCompanies_WS...');
        try {
            const companiesResult = await dataAccess.executeProc({
                url: instance.rows[0].url,
                username: instance.rows[0].username,
                password: instance.rows[0].password,
                procedure: 'DK_GetCompanies_WS',
                parameters: {}
            });
            console.log('✓ Companies result:', companiesResult);
        } catch (err) {
            console.log('✗ Companies error:', err.message);
        }
        console.log('');
        
        // Test DK_GetLines_WS
        console.log('Testing DK_GetLines_WS...');
        try {
            const linesResult = await dataAccess.executeProc({
                url: instance.rows[0].url,
                username: instance.rows[0].username,
                password: instance.rows[0].password,
                procedure: 'DK_GetLines_WS',
                parameters: {}
            });
            console.log('✓ Lines result:', linesResult);
        } catch (err) {
            console.log('✗ Lines error:', err.message);
        }
        console.log('');
        
        // Test DK_GetStates_WS
        console.log('Testing DK_GetStates_WS...');
        try {
            const statesResult = await dataAccess.executeProc({
                url: instance.rows[0].url,
                username: instance.rows[0].username,
                password: instance.rows[0].password,
                procedure: 'DK_GetStates_WS',
                parameters: {}
            });
            console.log('✓ States result:', statesResult);
        } catch (err) {
            console.log('✗ States error:', err.message);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await pool.end();
        console.log('\nTest completed.');
    }
}

// Run the test
testFormsAPI();