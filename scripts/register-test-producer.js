const axios = require('axios');

async function registerTestProducer() {
    try {
        const response = await axios.post('http://localhost:5000/api/producer/auth/register', {
            instanceId: 4, // ISC instance
            email: 'john.producer@example.com',
            password: 'Producer123!',
            firstName: 'John',
            lastName: 'Producer',
            agencyName: 'ABC Insurance Agency',
            phone: '555-0123',
            address1: '123 Main Street',
            address2: 'Suite 100',
            city: 'Chicago',
            state: 'IL',
            zip: '60601'
        });

        console.log('Registration successful!');
        console.log('Producer ID:', response.data.producerId);
        console.log('Message:', response.data.message);
        console.log('\nNote: The account needs to be verified and approved before login.');
        
    } catch (error) {
        if (error.response) {
            console.error('Registration failed:', error.response.data.error || error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

registerTestProducer();