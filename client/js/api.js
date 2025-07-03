/**
 * API Communication Layer
 * Handles all HTTP requests to the TaskFlow server
 */

class APIClient {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.authToken = localStorage.getItem('authToken');
        
        // Request interceptor for adding auth headers
        this.setupInterceptors();
    }

    /**
     * Get the base URL for API requests
     */
    getBaseURL() {
        // Check if we're in development or production
        const isDevelopment = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1';
        
        if (isDevelopment) {
            return 'http://localhost:3000/api';
        }
        
        // For production, use the same origin
        return `${window.location.origin}/api`;
    }

    /**
     * Set up request interceptors
     */
    setupInterceptors() {
        // Update auth token when it changes
        window.addEventListener('authTokenChanged', (event) => {
            this.authToken = event.detail.token;
        });
    }

    /**
     * Make HTTP request with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add auth token if available
        if (this.authToken) {
            config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        try {
            console.log(`🌐 ${config.method || 'GET'} ${url}`);
            
            const response = await fetch(url, config);
            
            // Handle different response types
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                // Handle specific error cases
                if (response.status === 401) {
                    // Unauthorized - clear token and redirect to login
                    this.handleUnauthorized();
                    throw new APIError('Session expired. Please login again.', 401, data);
                }
                
                if (response.status === 403) {
                    throw new APIError('Permission denied.', 403, data);
                }
                
                if (response.status === 404) {
                    throw new APIError('Resource not found.', 404, data);
                }
                
                if (response.status >= 500) {
                    throw new APIError('Server error. Please try again later.', response.status, data);
                }
                
                // General error
                const errorMessage = data?.error || data?.message || 'Request failed';
                throw new APIError(errorMessage, response.status, data);
            }

            console.log(`✅ ${config.method || 'GET'} ${url} - Success`);
            return data;

        } catch (error) {
            console.error(`❌ ${config.method || 'GET'} ${url} - Error:`, error);
            
            // Network errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new APIError('Network error. Please check your connection.', 0);
            }
            
            // Re-throw API errors
            if (error instanceof APIError) {
                throw error;
            }
            
            // Unknown errors
            throw new APIError('An unexpected error occurred.', 0, error);
        }
    }

    /**
     * Handle unauthorized access
     */
    handleUnauthorized() {
        this.authToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Dispatch event for other components to handle
        window.dispatchEvent(new CustomEvent('authExpired'));
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return this.request(endpoint + url.search, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    /**
     * Upload file (multipart/form-data)
     */
    async upload(endpoint, formData) {
        const config = {
            method: 'POST',
            body: formData
        };

        // Don't set Content-Type for FormData - browser will set it with boundary
        if (this.authToken) {
            config.headers = {
                Authorization: `Bearer ${this.authToken}`
            };
        }

        return this.request(endpoint, config);
    }

    // =================== Authentication API ===================

    /**
     * Register new user
     */
    async register(userData) {
        const response = await this.post('/auth/register', userData);
        
        if (response.token) {
            this.setAuthToken(response.token);
        }
        
        return response;
    }

    /**
     * Login user
     */
    async login(credentials) {
        const response = await this.post('/auth/login', credentials);
        
        if (response.token) {
            this.setAuthToken(response.token);
        }
        
        return response;
    }

    /**
     * Get user profile
     */
    async getProfile() {
        return this.get('/auth/profile');
    }

    /**
     * Update user profile
     */
    async updateProfile(profileData) {
        return this.put('/auth/profile', profileData);
    }

    /**
     * Change password
     */
    async changePassword(passwordData) {
        return this.put('/auth/change-password', passwordData);
    }

    /**
     * Refresh token
     */
    async refreshToken() {
        const response = await this.post('/auth/refresh');
        
        if (response.token) {
            this.setAuthToken(response.token);
        }
        
        return response;
    }

    // =================== Task API ===================

    /**
     * Get all tasks with filters
     */
    async getTasks(filters = {}) {
        return this.get('/tasks', filters);
    }

    /**
     * Get task by ID
     */
    async getTask(taskId) {
        return this.get(`/tasks/${taskId}`);
    }

    /**
     * Create new task
     */
    async createTask(taskData) {
        return this.post('/tasks', taskData);
    }

    /**
     * Update task
     */
    async updateTask(taskId, taskData) {
        return this.put(`/tasks/${taskId}`, taskData);
    }

    /**
     * Delete task
     */
    async deleteTask(taskId) {
        return this.delete(`/tasks/${taskId}`);
    }

    /**
     * Get task statistics
     */
    async getTaskStats() {
        return this.get('/tasks/stats');
    }

    // =================== User API ===================

    /**
     * Get all users
     */
    async getUsers(options = {}) {
        return this.get('/users', options);
    }

    /**
     * Get user by ID
     */
    async getUser(userId) {
        return this.get(`/users/${userId}`);
    }

    /**
     * Update user
     */
    async updateUser(userId, userData) {
        return this.put(`/users/${userId}`, userData);
    }

    /**
     * Get dashboard statistics
     */
    async getDashboardStats() {
        return this.get('/users/dashboard/stats');
    }

    /**
     * Get user's tasks
     */
    async getUserTasks(userId, filters = {}) {
        return this.get(`/users/${userId}/tasks`, filters);
    }

    // =================== Utility Methods ===================

    /**
     * Set authentication token
     */
    setAuthToken(token) {
        this.authToken = token;
        localStorage.setItem('authToken', token);
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('authTokenChanged', {
            detail: { token }
        }));
    }

    /**
     * Clear authentication token
     */
    clearAuthToken() {
        this.authToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        window.dispatchEvent(new CustomEvent('authTokenChanged', {
            detail: { token: null }
        }));
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.authToken;
    }

    /**
     * Get current auth token
     */
    getAuthToken() {
        return this.authToken;
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return response.ok;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const response = await this.get('/health');
            return {
                status: 'connected',
                serverTime: response.timestamp,
                uptime: response.uptime
            };
        } catch (error) {
            return {
                status: 'disconnected',
                error: error.message
            };
        }
    }
}

/**
 * Custom error class for API errors
 */
class APIError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }

    /**
     * Check if error is a network error
     */
    isNetworkError() {
        return this.status === 0;
    }

    /**
     * Check if error is a client error (4xx)
     */
    isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    /**
     * Check if error is a server error (5xx)
     */
    isServerError() {
        return this.status >= 500;
    }

    /**
     * Check if error is unauthorized
     */
    isUnauthorized() {
        return this.status === 401;
    }

    /**
     * Check if error is forbidden
     */
    isForbidden() {
        return this.status === 403;
    }

    /**
     * Check if error is not found
     */
    isNotFound() {
        return this.status === 404;
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage() {
        if (this.isNetworkError()) {
            return 'Please check your internet connection and try again.';
        }
        
        if (this.isUnauthorized()) {
            return 'Your session has expired. Please login again.';
        }
        
        if (this.isForbidden()) {
            return 'You don\'t have permission to perform this action.';
        }
        
        if (this.isNotFound()) {
            return 'The requested resource was not found.';
        }
        
        if (this.isServerError()) {
            return 'Server error. Please try again later.';
        }
        
        return this.message || 'An unexpected error occurred.';
    }
}

/**
 * Request cache for GET requests
 */
class RequestCache {
    constructor(ttl = 5 * 60 * 1000) { // 5 minutes default TTL
        this.cache = new Map();
        this.ttl = ttl;
    }

    /**
     * Get cached response
     */
    get(key) {
        const cached = this.cache.get(key);
        
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    /**
     * Set cached response
     */
    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clear expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }
}

// Create global API client instance
window.api = new APIClient();

// Create request cache instance
window.requestCache = new RequestCache();

// Auto-cleanup cache every 10 minutes
setInterval(() => {
    window.requestCache.cleanup();
}, 10 * 60 * 1000);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, APIError, RequestCache };
}