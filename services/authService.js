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
        console.log('Authenticating with:', url);
        
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

            const response = await fetch(`${url}/logon.asmx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/IMSWebServices/Logon/LoginIMSUser'
                },
                body: soapEnvelope
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('Authentication response:', responseText);
            
            // Extract token from nested XML structure
            // Look for LoginIMSUserResult first, then extract Token
            const resultMatch = responseText.match(/<LoginIMSUserResult[^>]*>(.*?)<\/LoginIMSUserResult>/s);
            if (!resultMatch) {
                throw new Error('Could not find LoginIMSUserResult in authentication response');
            }
            
            const resultContent = resultMatch[1];
            const tokenMatch = resultContent.match(/<Token>(.*?)<\/Token>/);
            if (!tokenMatch) {
                throw new Error('Could not extract token from LoginIMSUserResult');
            }

            const token = tokenMatch[1];

            // Cache the token
            this.tokens.set(url, token);
            
            // Set token expiry (55 minutes)
            setTimeout(() => {
                this.tokens.delete(url);
            }, 55 * 60 * 1000);

            return token;

        } catch (error) {
            console.error('Authentication error:', error);
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