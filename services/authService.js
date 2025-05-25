class AuthService {
    constructor() {
        this.authData = new Map(); // Cache auth data (token + userGuid) by URL
    }

    async getToken(url, username, password) {
        // Check cache first
        const cachedAuthData = this.authData.get(url);
        if (cachedAuthData) {
            return cachedAuthData.token;
        }

        const authData = await this.authenticate(url, username, password);
        return authData.token;
    }

    async getUserGuid(url, username, password) {
        // Check cache first
        const cachedAuthData = this.authData.get(url);
        if (cachedAuthData) {
            return cachedAuthData.userGuid;
        }

        const authData = await this.authenticate(url, username, password);
        return authData.userGuid;
    }

    async authenticate(url, username, password) {
        console.log('=== AUTHENTICATION START ===');
        console.log('IMS URL:', url);
        console.log('Username:', username);
        console.log('Password length:', password ? password.length : 'undefined');
        console.log('Raw password value:', JSON.stringify(password));
        console.log('Full request URL:', `${url}/logon.asmx`);
        
        try {
            // Clean the password - remove "e.g., " prefix if present
            const cleanPassword = password ? password.replace(/^e\.g\.,\s*/, '').trim() : '';
            console.log('Cleaned password:', JSON.stringify(cleanPassword));
            
            // Using SOAP 1.1 as per documentation
            const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <LoginIMSUser xmlns="http://tempuri.org/IMSWebServices/Logon">
            <userName>${username}</userName>
            <tripleDESEncryptedPassword>${cleanPassword}</tripleDESEncryptedPassword>
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

            const requestOptions = {
                method: 'POST',
                headers: requestHeaders,
                body: soapEnvelope
            };

            console.log('=== FULL HTTP REQUEST ===');
            console.log('Method:', requestOptions.method);
            console.log('URL:', `${url}/logon.asmx`);
            console.log('Headers:', JSON.stringify(requestOptions.headers, null, 2));
            console.log('Body length:', requestOptions.body.length);
            console.log('Full request body:');
            console.log(requestOptions.body);
            console.log('=== END FULL HTTP REQUEST ===');

            const response = await fetch(`${url}/logon.asmx`, requestOptions);

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

            // Extract UserGuid from the same response
            const userGuidMatch = resultContent.match(/<UserGuid>(.*?)<\/UserGuid>/);
            console.log('UserGuid match:', userGuidMatch ? 'FOUND' : 'NOT FOUND');
            if (!userGuidMatch) {
                console.log('FAILED: Could not extract UserGuid from LoginIMSUserResult');
                throw new Error('Could not extract UserGuid from LoginIMSUserResult');
            }

            const userGuid = userGuidMatch[1];
            console.log('Extracted UserGuid:', userGuid);
            console.log('UserGuid validation - is null GUID?:', userGuid === '00000000-0000-0000-0000-000000000000');

            // Check if token is valid (not null GUID)
            if (token === '00000000-0000-0000-0000-000000000000') {
                console.log('ERROR: IMS returned null GUID token - authentication failed on IMS side');
                throw new Error('IMS authentication failed: Invalid credentials or account issue');
            }

            // Check if UserGuid is valid (not null GUID)
            if (userGuid === '00000000-0000-0000-0000-000000000000') {
                console.log('ERROR: IMS returned null GUID for UserGuid - authentication failed on IMS side');
                throw new Error('IMS authentication failed: Invalid credentials or account issue');
            }

            // Cache both token and userGuid
            const authData = { token, userGuid };
            this.authData.set(url, authData);
            console.log('Auth data cached successfully');
            
            // Set auth data expiry (55 minutes)
            setTimeout(() => {
                console.log('Auth data expired for URL:', url);
                this.authData.delete(url);
            }, 55 * 60 * 1000);

            console.log('=== AUTHENTICATION SUCCESS ===');
            return authData;

        } catch (error) {
            console.log('=== AUTHENTICATION FAILED ===');
            console.error('Authentication error:', error);
            console.log('Error type:', error.constructor.name);
            console.log('Error message:', error.message);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    clearToken(url) {
        this.authData.delete(url);
    }


    isTokenValid(token) {
        // Add any token validation logic here if needed
        return token && token.length > 0;
    }
}

module.exports = new AuthService(); 