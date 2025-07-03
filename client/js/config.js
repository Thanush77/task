const config = {
    development: {
        API_BASE_URL: 'http://54.146.215.18:3001/api',
        DEBUG: true,
        LOG_LEVEL: 'debug'
    },
    production: {
        API_BASE_URL: 'http://54.146.215.18:3001/api',
        DEBUG: false,
        LOG_LEVEL: 'error'
    }
};

// Auto-detect environment
const environment = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'development' : 'production';
window.APP_CONFIG = config[environment];
console.log('APP_CONFIG:', window.APP_CONFIG);