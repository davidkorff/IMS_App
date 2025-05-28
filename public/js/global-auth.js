// Global Authentication System
// This script automatically handles token expiration across all pages

(function() {
    'use strict';

    class GlobalAuth {
        static TOKEN_KEY = 'token';
        static USER_KEY = 'user';
        static CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

        static init() {
            // Don't run auth checks on login page
            if (this.isLoginPage()) {
                return;
            }

            // Check auth immediately
            if (!this.isValidSession()) {
                this.redirectToLogin();
                return;
            }

            // Set up periodic checks
            setInterval(() => {
                if (!this.isValidSession()) {
                    this.showSessionExpiredMessage();
                    setTimeout(() => this.redirectToLogin(), 3000);
                }
            }, this.CHECK_INTERVAL);

            // Intercept all fetch requests automatically
            this.interceptFetch();
        }

        static isLoginPage() {
            const path = window.location.pathname;
            return path === '/' || path === '/index.html' || path.endsWith('index.html');
        }

        static getToken() {
            return localStorage.getItem(this.TOKEN_KEY);
        }

        static isValidSession() {
            const token = this.getToken();
            if (!token) return false;
            return !this.isTokenExpired(token);
        }

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

        static redirectToLogin() {
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.USER_KEY);
            window.location.href = '/';
        }

        static showSessionExpiredMessage() {
            this.showMessage('Your session has expired. Redirecting to login...', 'error');
        }

        static showMessage(text, type = 'info') {
            // Remove existing message
            const existing = document.getElementById('global-auth-message');
            if (existing) existing.remove();

            const message = document.createElement('div');
            message.id = 'global-auth-message';
            message.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: ${type === 'error' ? '#f44336' : '#2196F3'};
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 14px;
                    max-width: 350px;
                    animation: slideInFromRight 0.3s ease-out;
                ">${text}</div>
            `;
            
            document.body.appendChild(message);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (message.parentNode) {
                    message.remove();
                }
            }, 5000);
        }

        static interceptFetch() {
            const originalFetch = window.fetch;
            
            window.fetch = async function(...args) {
                let [url, options = {}] = args;

                // Only intercept API calls
                if (typeof url === 'string' && url.startsWith('/api')) {
                    const token = GlobalAuth.getToken();
                    
                    if (!token || GlobalAuth.isTokenExpired(token)) {
                        GlobalAuth.showSessionExpiredMessage();
                        setTimeout(() => GlobalAuth.redirectToLogin(), 3000);
                        throw new Error('Session expired');
                    }

                    // Add auth header
                    options.headers = {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        ...options.headers
                    };
                }

                try {
                    const response = await originalFetch(url, options);
                    
                    // Handle 401 responses for API calls
                    if (response.status === 401 && typeof url === 'string' && url.startsWith('/api')) {
                        GlobalAuth.showSessionExpiredMessage();
                        setTimeout(() => GlobalAuth.redirectToLogin(), 3000);
                        throw new Error('Authentication failed');
                    }
                    
                    return response;
                } catch (error) {
                    throw error;
                }
            };
        }

        // Helper method for manual auth checks
        static async fetchWithAuth(url, options = {}) {
            const token = this.getToken();

            if (!token || this.isTokenExpired(token)) {
                this.showSessionExpiredMessage();
                setTimeout(() => this.redirectToLogin(), 3000);
                throw new Error('Session expired');
            }

            options.headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            };

            const response = await fetch(url, options);
            
            if (response.status === 401) {
                this.showSessionExpiredMessage();
                setTimeout(() => this.redirectToLogin(), 3000);
                throw new Error('Authentication failed');
            }

            return response;
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

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => GlobalAuth.init());
    } else {
        GlobalAuth.init();
    }

    // Make available globally
    window.GlobalAuth = GlobalAuth;
})();