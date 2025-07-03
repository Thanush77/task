const config = {
    development: {
        API_BASE_URL: 'http://localhost:3000/api',
        DEBUG: true,
        LOG_LEVEL: 'debug'
    },
    production: {
        API_BASE_URL: '/api', // Same origin in production
        DEBUG: false,
        LOG_LEVEL: 'error'
    }
};

// Auto-detect environment
const environment = window.location.hostname === 'localhost' ? 'development' : 'production';
window.APP_CONFIG = config[environment];