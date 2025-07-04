/**
 * Authentication Handler
 * Manages user authentication, session handling, and auth UI
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('authToken');
        this.isLoading = false;
        
        this.init();
    }

    /**
     * Initialize authentication manager
     */
    init() {
        // Load saved user data
        this.loadSavedUser();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up automatic token refresh
        this.setupTokenRefresh();
        
        // Handle auth state changes
        this.handleAuthStateChange();
    }

    /**
     * Load saved user data from localStorage
     */
    loadSavedUser() {
        const savedUser = localStorage.getItem('user');
        if (savedUser && this.authToken) {
            try {
                this.currentUser = JSON.parse(savedUser);
                console.log('👤 Loaded saved user:', this.currentUser.username);
            } catch (error) {
                console.error('Failed to parse saved user data:', error);
                this.clearAuthData();
            }
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for auth token changes
        window.addEventListener('authTokenChanged', (event) => {
            this.authToken = event.detail.token;
        });

        // Listen for auth expiration
        window.addEventListener('authExpired', () => {
            this.handleAuthExpired();
        });

        // Form submissions
        this.setupFormListeners();
        
        // Password validation
        this.setupPasswordValidation();
    }

    /**
     * Set up form event listeners
     */
    setupFormListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProfileUpdate();
            });
        }
    }

    /**
     * Set up password validation
     */
    setupPasswordValidation() {
        const passwordInput = document.getElementById('regPassword');
        const requirementsDiv = document.getElementById('passwordRequirements');
        
        if (passwordInput && requirementsDiv) {
            passwordInput.addEventListener('input', () => {
                const password = passwordInput.value;
                this.validatePassword(password);
            });

            passwordInput.addEventListener('focus', () => {
                requirementsDiv.style.display = 'block';
            });

            passwordInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (passwordInput.value) {
                        requirementsDiv.style.display = 'none';
                    }
                }, 200);
            });
        }
    }

    /**
     * Validate password and update UI
     */
    validatePassword(password) {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password)
        };

        // Update requirement indicators
        this.updateRequirement('req-length', requirements.length);
        this.updateRequirement('req-uppercase', requirements.uppercase);
        this.updateRequirement('req-lowercase', requirements.lowercase);
        this.updateRequirement('req-number', requirements.number);

        return Object.values(requirements).every(req => req);
    }

    /**
     * Update password requirement indicator
     */
    updateRequirement(elementId, isValid) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = isValid ? 'valid' : '';
        }
    }

    /**
     * Set up automatic token refresh
     */
    setupTokenRefresh() {
        // Refresh token every 6 hours
        setInterval(() => {
            if (this.isAuthenticated()) {
                this.refreshToken();
            }
        }, 6 * 60 * 60 * 1000);
    }

    /**
     * Handle authentication state changes
     */
    handleAuthStateChange() {
        if (this.isAuthenticated()) {
            this.showApplication();
        } else {
            this.showAuthentication();
        }
    }

    /**
     * Handle login form submission
     */
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showAuthError('Please enter both username and password.');
            return;
        }

        this.setLoadingState('loginBtn', true, 'Signing In...');
        this.hideAuthMessages();

        try {
            const response = await window.api.login({ username, password });
            
            // Save user data
            this.currentUser = response.user;
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            this.showAuthSuccess('Welcome back! Redirecting...');
            
            // Show application after short delay
            setTimeout(() => {
                this.showApplication();
                this.initializeApplication();
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            this.showAuthError(error.getUserMessage());
        } finally {
            this.setLoadingState('loginBtn', false, 'Sign In');
        }
    }

    /**
     * Handle register form submission
     */
    async handleRegister() {
        const fullName = document.getElementById('regFullName').value.trim();
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        // Validation
        if (!fullName || !username || !email || !password) {
            this.showAuthError('Please fill in all fields.');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showAuthError('Please enter a valid email address.');
            return;
        }

        if (!this.validatePassword(password)) {
            this.showAuthError('Password does not meet the requirements.');
            return;
        }

        this.setLoadingState('registerBtn', true, 'Creating Account...');
        this.hideAuthMessages();

        try {
            const response = await window.api.register({
                fullName,
                username,
                email,
                password
            });
            
            // Save user data
            this.currentUser = response.user;
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            this.showAuthSuccess('Account created successfully! Redirecting...');
            
            // Show application after short delay
            setTimeout(() => {
                this.showApplication();
                this.initializeApplication();
            }, 1000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showAuthError(error.getUserMessage());
        } finally {
            this.setLoadingState('registerBtn', false, 'Create Account');
        }
    }

    /**
     * Handle profile update
     */
    async handleProfileUpdate() {
        const fullName = document.getElementById('profileFullName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();

        if (!fullName || !email) {
            window.showNotification('Please fill in all fields.', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            window.showNotification('Please enter a valid email address.', 'error');
            return;
        }

        try {
            const response = await window.api.updateProfile({
                fullName,
                email
            });
            
            // Update current user data
            this.currentUser = response.user;
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            // Update UI
            this.updateUserDisplay();
            
            window.showNotification('Profile updated successfully!', 'success');
            window.closeProfileModal();

        } catch (error) {
            console.error('Profile update error:', error);
            window.showNotification(error.getUserMessage(), 'error');
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            // Clear local data
            this.clearAuthData();
            
            // Show loading screen briefly
            this.showLoadingScreen();
            
            // Clear any cached data
            if (window.requestCache) {
                window.requestCache.clear();
            }
            
            // Show auth screen after delay
            setTimeout(() => {
                this.showAuthentication();
                this.hideLoadingScreen();
            }, 500);
            
            console.log('👋 User logged out successfully');

        } catch (error) {
            console.error('Logout error:', error);
            // Force logout even if API call fails
            this.clearAuthData();
            this.showAuthentication();
        }
    }

    /**
     * Refresh authentication token
     */
    async refreshToken() {
        if (!this.authToken) return;

        try {
            await window.api.refreshToken();
            console.log('🔄 Token refreshed successfully');
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.handleAuthExpired();
        }
    }

    /**
     * Handle authentication expiration
     */
    handleAuthExpired() {
        console.log('🔐 Authentication expired');
        
        this.clearAuthData();
        this.showAuthentication();
        
        window.showNotification('Your session has expired. Please login again.', 'warning');
    }

    /**
     * Clear authentication data
     */
    clearAuthData() {
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.api.clearAuthToken();
    }

    /**
     * Show authentication screen
     */
    showAuthentication() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('createTaskFab').style.display = 'none';
        
        // Reset forms
        this.resetAuthForms();
        this.hideAuthMessages();
    }

    /**
     * Show main application
     */
    showApplication() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('createTaskFab').style.display = 'block';
        
        // Update user display
        this.updateUserDisplay();
    }

    /**
     * Show loading screen
     */
    showLoadingScreen() {
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('createTaskFab').style.display = 'none';
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        document.getElementById('loadingScreen').style.display = 'none';
    }

    /**
     * Initialize application after login
     */
    async initializeApplication() {
        if (window.taskManager) {
            await window.taskManager.init();
        }
    }

    /**
     * Update user display in UI
     */
    updateUserDisplay() {
        if (!this.currentUser) return;

        const userName = document.getElementById('userName');
        const userFullName = document.getElementById('userFullName');
        const userAvatar = document.getElementById('userAvatar');

        if (userName) {
            userName.textContent = this.currentUser.fullName || this.currentUser.full_name || this.currentUser.username;
        }

        if (userFullName) {
            userFullName.textContent = this.currentUser.fullName || this.currentUser.full_name || this.currentUser.username;
        }

        if (userAvatar) {
            const name = this.currentUser.fullName || this.currentUser.full_name || this.currentUser.username;
            userAvatar.textContent = name.charAt(0).toUpperCase();
        }

        // Update profile form if modal is open
        this.updateProfileForm();
    }

    /**
     * Update profile form with current user data
     */
    updateProfileForm() {
        const profileFullName = document.getElementById('profileFullName');
        const profileEmail = document.getElementById('profileEmail');

        if (profileFullName && this.currentUser) {
            profileFullName.value = this.currentUser.fullName || this.currentUser.full_name || '';
        }

        if (profileEmail && this.currentUser) {
            profileEmail.value = this.currentUser.email || '';
        }
    }

    /**
     * Reset authentication forms
     */
    resetAuthForms() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) loginForm.reset();
        if (registerForm) registerForm.reset();
    }

    /**
     * Show authentication error
     */
    showAuthError(message) {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Show authentication success
     */
    showAuthSuccess(message) {
        const successDiv = document.getElementById('authSuccess');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
    }

    /**
     * Hide authentication messages
     */
    hideAuthMessages() {
        const errorDiv = document.getElementById('authError');
        const successDiv = document.getElementById('authSuccess');

        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }

    /**
     * Set button loading state
     */
    setLoadingState(buttonId, isLoading, loadingText = 'Loading...') {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const textSpan = button.querySelector('.btn-text');
        const loaderSpan = button.querySelector('.btn-loader');

        if (isLoading) {
            button.disabled = true;
            if (textSpan) textSpan.style.display = 'none';
            if (loaderSpan) {
                loaderSpan.style.display = 'flex';
                loaderSpan.innerHTML = `<div class="spinner"></div>${loadingText}`;
            }
        } else {
            button.disabled = false;
            if (textSpan) textSpan.style.display = 'block';
            if (loaderSpan) loaderSpan.style.display = 'none';
        }
    }

    /**
     * Validate email format
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.authToken && this.currentUser);
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user has specific role
     */
    hasRole(role) {
        return this.currentUser?.role === role;
    }

    /**
     * Check if user is admin
     */
    isAdmin() {
        return this.hasRole('admin');
    }

    /**
     * Get user initials for avatar
     */
    getUserInitials() {
        if (!this.currentUser) return 'U';
        
        const name = this.currentUser.fullName || this.currentUser.full_name || this.currentUser.username;
        return name.split(' ')
                  .map(n => n.charAt(0))
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
    }
}

// Global authentication functions
window.showLoginForm = function() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').style.display = 'none';
};

window.showRegisterForm = function() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').style.display = 'none';
};

window.logout = function() {
    if (window.authManager) {
        window.authManager.logout();
    }
};

window.toggleUserMenu = function() {
    const menu = document.getElementById('userMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
};

window.showProfileModal = function() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        // Update form with current user data
        if (window.authManager) {
            window.authManager.updateProfileForm();
        }
        modal.classList.add('active');
    }
    
    // Close user menu
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.classList.remove('show');
    }
};

window.closeProfileModal = function() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const menuBtn = document.querySelector('.menu-btn');
    
    if (userMenu && !userMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        userMenu.classList.remove('show');
    }
});

// Create global auth manager instance
// Remove this line:
// window.authManager = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}