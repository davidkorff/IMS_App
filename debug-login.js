const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function debugLogin() {
    try {
        console.log('Testing database connection...');
        const testConn = await pool.query('SELECT NOW()');
        console.log('✅ Database connected at:', testConn.rows[0].now);
        
        console.log('\nChecking users table...');
        const users = await pool.query('SELECT user_id, email, username FROM users');
        console.log(`Found ${users.rows.length} users:`);
        users.rows.forEach(user => {
            console.log(`  - ID: ${user.user_id}, Email: ${user.email}, Username: ${user.username}`);
        });
        
        if (users.rows.length > 0) {
            console.log('\nTesting password for first user...');
            const firstUser = await pool.query('SELECT * FROM users WHERE user_id = 1');
            if (firstUser.rows.length > 0) {
                const user = firstUser.rows[0];
                console.log(`User: ${user.email}`);
                
                // Test common passwords
                const testPasswords = ['password', 'admin', '123456', 'Password123'];
                for (const testPwd of testPasswords) {
                    const valid = await bcrypt.compare(testPwd, user.password);
                    console.log(`  Password "${testPwd}": ${valid ? '✅ VALID' : '❌ Invalid'}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    } finally {
        process.exit();
    }
}

debugLogin();