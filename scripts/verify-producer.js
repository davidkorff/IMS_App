const pool = require('../config/db');

async function verifyProducer(email) {
    try {
        const result = await pool.query(
            'UPDATE producers SET email_verified = true WHERE email = $1 RETURNING producer_id, email, first_name, last_name',
            [email]
        );
        
        if (result.rows.length > 0) {
            console.log('Producer verified:', result.rows[0]);
        } else {
            console.log('Producer not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
    console.log('Usage: node verify-producer.js <email>');
    process.exit(1);
}

verifyProducer(email);