// Auth Utilities for handling token expiration and redirects
class AuthUtils {
    static TOKEN_KEY = 'token';
    static USER_KEY = 'user';

    // Get token from localStorage
    static getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }
    
    // Get user from localStorage
    static async getUser() {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                return JSON.parse(userData);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    // Set token in localStorage
    static setToken(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    }

    // Remove token and user data
    static logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.redirectToLogin();
    }

    // Check if token exists
    static isAuthenticated() {
        return !!this.getToken();
    }

    // Redirect to login page
    static redirectToLogin() {
        window.location.href = '/';
    }

    // Parse JWT token to check expiration
    static isTokenExpired(token = null) {
        try {
            const tokenToCheck = token || this.getToken();
            if (!tokenToCheck) return true;

            const payload = JSON.parse(atob(tokenToCheck.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            
            return payload.exp < currentTime;
        } catch (error) {
            console.error('Error checking token expiration:', error);
            return true;
        }
    }

    // Enhanced fetch function with auth handling
    static async fetchWithAuth(url, options = {}) {
        const token = this.getToken();

        // Check if token exists
        if (!token) {
            this.redirectToLogin();
            return;
        }

        // Check if token is expired
        if (this.isTokenExpired(token)) {
            console.log('Token expired, redirecting to login');
            this.logout();
            return;
        }

        // Add auth header and instance ID
        const user = await this.getUser();
        const instanceId = user?.instance_id || localStorage.getItem('instanceId') || window.instanceId;
        
        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-instance-id': instanceId,
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers: authHeaders
            });

            // Handle 401 responses (token invalid/expired)
            if (response.status === 401) {
                console.log('Received 401, token invalid or expired');
                this.logout();
                return;
            }

            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    // Show auth error message to user
    static showAuthError(message = 'Your session has expired. Please log in again.') {
        // Create or update error message
        let errorDiv = document.getElementById('auth-error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'auth-error-message';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 300px;
                animation: slideInFromRight 0.3s ease-out;
            `;
            document.body.appendChild(errorDiv);
        }

        errorDiv.textContent = message;
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 3000);
    }

    // Initialize auth checks on page load
    static initialize() {
        // Check authentication on page load (except for login page)
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            if (!this.isAuthenticated() || this.isTokenExpired()) {
                this.showAuthError();
                setTimeout(() => this.redirectToLogin(), 2000);
                return false;
            }
        }

        // Set up periodic token expiration checks (every 5 minutes)
        setInterval(() => {
            if (this.isAuthenticated() && this.isTokenExpired()) {
                this.showAuthError('Your session has expired.');
                setTimeout(() => this.logout(), 2000);
            }
        }, 5 * 60 * 1000); // 5 minutes

        return true;
    }

    // Handle API response errors globally
    static handleApiResponse(response) {
        if (response.status === 401) {
            this.showAuthError();
            setTimeout(() => this.logout(), 2000);
            return false;
        }
        return true;
    }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInFromRight {
        0% {
            transform: translateX(100%);
            opacity: 0;
        }
        100% {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize auth utils when page loads
document.addEventListener('DOMContentLoaded', () => {
    AuthUtils.initialize();
});

// Make it available globally
window.AuthUtils = AuthUtils;

// Add helper functions for backward compatibility
window.checkAuth = async function() {
    const token = AuthUtils.getToken();
    if (!token || AuthUtils.isTokenExpired()) {
        return null;
    }
    
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            return null;
        }
    }
    
    // If no user data, try to fetch it
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            localStorage.setItem('user', JSON.stringify(user));
            return user;
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
    
    return null;
};

window.fetchWithAuth = function(url, options = {}) {
    return AuthUtils.fetchWithAuth(url, options);
};