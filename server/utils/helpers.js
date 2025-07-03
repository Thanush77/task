const validator = require('validator');

/**
 * Validate email format
 */
const validateEmail = (email) => {
    return validator.isEmail(email);
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
    const requirements = {
        minLength: 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumbers: /\d/.test(password),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const isValid = password.length >= requirements.minLength &&
                   requirements.hasUppercase &&
                   requirements.hasLowercase &&
                   requirements.hasNumbers;

    return {
        isValid,
        requirements: {
            'At least 8 characters': password.length >= 8,
            'Contains uppercase letter': requirements.hasUppercase,
            'Contains lowercase letter': requirements.hasLowercase,
            'Contains number': requirements.hasNumbers,
            'Contains special character (recommended)': requirements.hasSpecialChar
        }
    };
};

/**
 * Sanitize input to prevent XSS
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return validator.escape(input.trim());
};

/**
 * Generate random string
 */
const generateRandomString = (length = 32) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
};

/**
 * Format date for database
 */
const formatDateForDB = (date) => {
    if (!date) return null;
    
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Calculate time difference in minutes
 */
const calculateTimeDifference = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
    }
    
    if (end < start) {
        throw new Error('End time cannot be before start time');
    }
    
    return Math.round((end - start) / 60000); // Convert to minutes
};

/**
 * Paginate results
 */
const paginate = (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    
    return {
        limit: Math.min(limit, 100), // Max 100 items per page
        offset: Math.max(offset, 0)
    };
};

/**
 * Format validation errors
 */
const formatValidationErrors = (errors) => {
    if (Array.isArray(errors)) {
        return errors.map(error => ({
            field: error.path,
            message: error.message,
            value: error.value
        }));
    }
    
    return [{ message: errors.toString() }];
};

/**
 * Check if user has permission
 */
const hasPermission = (user, resource, action) => {
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    // User can only access their own resources
    if (resource.userId && resource.userId !== user.id) return false;
    if (resource.createdBy && resource.createdBy !== user.id && resource.assignedTo !== user.id) {
        return action === 'read'; // Can only read if assigned or created
    }
    
    return true;
};

/**
 * Generate avatar URL from initials
 */
const generateAvatarUrl = (fullName, size = 100) => {
    const initials = fullName
        .split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
    
    const colors = ['4f46e5', '7c3aed', '059669', 'dc2626', 'ea580c', '0891b2'];
    const color = colors[fullName.length % colors.length];
    
    return `https://ui-avatars.com/api/?name=${initials}&size=${size}&background=${color}&color=fff`;
};

/**
 * Log activity
 */
const logActivity = (userId, action, resource, details = {}) => {
    console.log(`[ACTIVITY] User ${userId} ${action} ${resource}`, details);
    // In production, you might want to save this to a database
};

module.exports = {
    validateEmail,
    validatePassword,
    sanitizeInput,
    generateRandomString,
    formatDateForDB,
    calculateTimeDifference,
    paginate,
    formatValidationErrors,
    hasPermission,
    generateAvatarUrl,
    logActivity
};