const { Pool } = require('pg');

// Test with explicit connection parameters
const testPool = new Pool({
    user: 'postgres',
    password: 'D040294k',
    host: 'localhost',
    port: 5432,
    database: 'IMS_Application',
    connectionTimeoutMillis: 5000
});

async function testConnection() {
    console.log('Testing connection with:');
    console.log('- Host: localhost');
    console.log('- Port: 5432');
    console.log('- User: postgres');
    console.log('- Database: IMS_Application');
    console.log('- Password: [PROVIDED]');
    
    try {
        const client = await testPool.connect();
        console.log('✅ Connected successfully!');
        
        const result = await client.query('SELECT NOW()');
        console.log('Current time:', result.rows[0].now);
        
        // Check if users table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);
        console.log('Users table exists:', tableCheck.rows[0].exists);
        
        if (tableCheck.rows[0].exists) {
            const userCount = await client.query('SELECT COUNT(*) FROM users');
            console.log('Number of users:', userCount.rows[0].count);
        }
        
        client.release();
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\nPostgreSQL appears to not be listening on localhost:5432');
            console.log('Possible solutions:');
            console.log('1. Check if PostgreSQL is running: sudo service postgresql status');
            console.log('2. Check PostgreSQL config in postgresql.conf for listen_addresses');
            console.log('3. Try connecting via Unix socket instead of TCP/IP');
        } else if (error.code === '28P01') {
            console.log('\nAuthentication failed - check username/password');
        } else if (error.code === '3D000') {
            console.log('\nDatabase "IMS_Application" does not exist');
            console.log('Create it with: createdb -U postgres IMS_Application');
        }
    } finally {
        await testPool.end();
        process.exit();
    }
}

testConnection();