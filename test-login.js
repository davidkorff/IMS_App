const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function testLogin() {
    try {
        console.log('Testing database connection and login...\n');
        
        // Test basic connection
        const testQuery = await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful:', testQuery.rows[0].now);
        
        // Check users table
        const usersCheck = await pool.query(`
            SELECT COUNT(*) as user_count FROM users
        `);
        console.log(`\n📊 Total users in database: ${usersCheck.rows[0].user_count}`);
        
        // List all users (without passwords)
        const usersList = await pool.query(`
            SELECT user_id, email, full_name, created_at 
            FROM users 
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log('\n👥 Recent users:');
        usersList.rows.forEach(user => {
            console.log(`  - ${user.email} (ID: ${user.user_id}, Name: ${user.full_name || 'Not set'})`);
        });
        
        // Test password hashing
        const testPassword = 'testPassword123';
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        console.log('\n🔐 Password hashing test:');
        console.log(`  Original: ${testPassword}`);
        console.log(`  Hashed: ${hashedPassword.substring(0, 20)}...`);
        
        const isMatch = await bcrypt.compare(testPassword, hashedPassword);
        console.log(`  Verification: ${isMatch ? '✅ Success' : '❌ Failed'}`);
        
        // Check if JWT_SECRET is set
        console.log(`\n🔑 JWT_SECRET configured: ${process.env.JWT_SECRET ? '✅ Yes' : '❌ No'}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testLogin();