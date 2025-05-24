class AuthService {
    constructor() {
        this.tokens = new Map(); // Cache tokens by URL
    }

    async getToken(url, username, password) {
        // Check cache first
        const cachedToken = this.tokens.get(url);
        if (cachedToken) {
            return cachedToken;
        }

        return this.authenticate(url, username, password);
    }

    async authenticate(url, username, password) {
        console.log('=== AUTHENTICATION START ===');
        console.log('IMS URL:', url);
        console.log('Username:', username);
        console.log('Password length:', password ? password.length : 'undefined');
        console.log('Full request URL:', `${url}/logon.asmx`);
        
        try {
            // Using SOAP 1.1 as per documentation
            const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <LoginIMSUser xmlns="http://tempuri.org/IMSWebServices/Logon">
            <userName>${username}</userName>
            <tripleDESEncryptedPassword>${password}</tripleDESEncryptedPassword>
        </LoginIMSUser>
    </soap:Body>
</soap:Envelope>`;

            console.log('SOAP envelope being sent:');
            console.log(soapEnvelope);

            const requestHeaders = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IMSWebServices/Logon/LoginIMSUser'
            };
            console.log('Request headers:', requestHeaders);

            const response = await fetch(`${url}/logon.asmx`, {
                method: 'POST',
                headers: requestHeaders,
                body: soapEnvelope
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('Raw authentication response:', responseText);
            
            // Extract token from nested XML structure
            // Look for LoginIMSUserResult first, then extract Token
            const resultMatch = responseText.match(/<LoginIMSUserResult[^>]*>(.*?)<\/LoginIMSUserResult>/s);
            console.log('LoginIMSUserResult match:', resultMatch ? 'FOUND' : 'NOT FOUND');
            if (!resultMatch) {
                console.log('FAILED: Could not find LoginIMSUserResult in authentication response');
                throw new Error('Could not find LoginIMSUserResult in authentication response');
            }
            
            const resultContent = resultMatch[1];
            console.log('Result content extracted:', resultContent);
            
            const tokenMatch = resultContent.match(/<Token>(.*?)<\/Token>/);
            console.log('Token match:', tokenMatch ? 'FOUND' : 'NOT FOUND');
            if (!tokenMatch) {
                console.log('FAILED: Could not extract token from LoginIMSUserResult');
                throw new Error('Could not extract token from LoginIMSUserResult');
            }

            const token = tokenMatch[1];
            console.log('Extracted token:', token);
            console.log('Token validation - is null GUID?:', token === '00000000-0000-0000-0000-000000000000');

            // Check if token is valid (not null GUID)
            if (token === '00000000-0000-0000-0000-000000000000') {
                console.log('ERROR: IMS returned null GUID token - authentication failed on IMS side');
                throw new Error('IMS authentication failed: Invalid credentials or account issue');
            }

            // Cache the token
            this.tokens.set(url, token);
            console.log('Token cached successfully');
            
            // Set token expiry (55 minutes)
            setTimeout(() => {
                console.log('Token expired for URL:', url);
                this.tokens.delete(url);
            }, 55 * 60 * 1000);

            console.log('=== AUTHENTICATION SUCCESS ===');
            return token;

        } catch (error) {
            console.log('=== AUTHENTICATION FAILED ===');
            console.error('Authentication error:', error);
            console.log('Error type:', error.constructor.name);
            console.log('Error message:', error.message);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    clearToken(url) {
        this.tokens.delete(url);
    }

    isTokenValid(token) {
        // Add any token validation logic here if needed
        return token && token.length > 0;
    }
}

module.exports = new AuthService(); 