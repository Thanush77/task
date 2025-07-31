/**
 * Application Configuration
 * Handles environment-specific settings
 */

// Detect environment and set API base URL
const getAPIBaseURL = () => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    
    // Production server deployment (your server)
    if (hostname === '54.80.7.27' || hostname === '172.31.36.218' || hostname.includes('your-domain.com')) {
        return `${protocol}//${hostname}/api`;
    }
    
    // Vercel deployment
    if (hostname.includes('vercel.app')) {
        return `${protocol}//${hostname}/api`;
    }
    
    // Development environment
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // If client is served from port 8080 but API is on 3000
        const apiPort = port === '8080' ? '3000' : port;
        return `${protocol}//${hostname}:${apiPort}/api`;
    }
    
    
    // Fallback
    return '/api';
};

// Global configuration object
window.APP_CONFIG = {
    API_BASE_URL: getAPIBaseURL(),
    WS_URL: window.location.origin.replace('http', 'ws').replace('https', 'wss'),
    APP_NAME: 'TaskFlow Analytics',
    VERSION: '2.0.0',
    FEATURES: {
        REAL_TIME_Updates: true,
        ANALYTICS: true,
        REPORTS_EXPORT: true,
        TIME_TRACKING: true,
        NOTIFICATIONS: true
    },
    LIMITS: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        MAX_DESCRIPTION_LENGTH: 5000,
        AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
        NOTIFICATION_INTERVAL: 30 * 1000 // 30 seconds
    }
};

// Export configuration for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.APP_CONFIG;
}

console.log('🔧 App Config loaded:', {
    API_BASE_URL: window.APP_CONFIG.API_BASE_URL,
    WS_URL: window.APP_CONFIG.WS_URL,
    Environment: window.location.hostname.includes('localhost') ? 'Development' : 'Production'
});