const pool = require('./config/db');

async function testConnection() {
    try {
        console.log('Testing database connection...');
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connected successfully!');
        console.log('Current time from DB:', result.rows[0].now);
        
        // Test users table
        const usersTest = await pool.query('SELECT COUNT(*) as count FROM users');
        console.log('Users in database:', usersTest.rows[0].count);
        
        // List first user
        const firstUser = await pool.query('SELECT user_id, email FROM users LIMIT 1');
        if (firstUser.rows.length > 0) {
            console.log('Sample user:', firstUser.rows[0]);
        }
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Full error:', error);
    } finally {
        process.exit();
    }
}

testConnection();