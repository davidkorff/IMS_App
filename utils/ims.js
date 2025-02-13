const soap = require('soap');

async function getIMSToken(instanceId) {
    try {
        console.log('Getting IMS token for instance:', instanceId);
        
        // Get instance details from database
        const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/instances/${instanceId}`);
        console.log('Instance details response:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to get instance details:', errorText);
            throw new Error('Failed to get instance details');
        }

        const instance = await response.json();
        console.log('Instance details retrieved:', {
            url: instance.url,
            username: instance.username
        });
        
        // Create SOAP client for login
        console.log('Creating SOAP client for:', `${instance.url}/logon.asmx?wsdl`);
        const client = await soap.createClientAsync(`${instance.url}/logon.asmx?wsdl`);
        
        // Call LoginUser method
        console.log('Calling LoginUser with username:', instance.username);
        const [result] = await client.LoginUserAsync({
            userName: instance.username,
            password: instance.password
        });

        if (!result || !result.LoginUserResult) {
            console.error('No token in login response:', result);
            throw new Error('Failed to get IMS token');
        }

        console.log('Successfully got IMS token');
        return result.LoginUserResult;
    } catch (error) {
        console.error('Error getting IMS token:', error);
        throw error;
    }
}

module.exports = {
    getIMSToken
}; 