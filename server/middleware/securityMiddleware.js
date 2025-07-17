const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');

// Advanced rate limiting with different limits for different endpoints
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: message,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
    });
};

// Different rate limits for different operations
const rateLimits = {
    // Authentication endpoints - stricter limits
    auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts'),
    
    // File uploads - moderate limits
    upload: createRateLimiter(15 * 60 * 1000, 10, 'Too many file uploads'),
    
    // API endpoints - generous limits
    api: createRateLimiter(15 * 60 * 1000, 100, 'Too many API requests'),
    
    // Email sending - strict limits
    email: createRateLimiter(60 * 60 * 1000, 5, 'Too many email requests')
};

// IP-based blocking system
const blockedIPs = new Map();
const suspiciousActivity = new Map();

const blockIP = (ip, duration = 24 * 60 * 60 * 1000) => {
    blockedIPs.set(ip, Date.now() + duration);
    console.log(`🚫 IP ${ip} blocked for ${duration / 1000} seconds`);
};

const isIPBlocked = (ip) => {
    const blockTime = blockedIPs.get(ip);
    if (blockTime && Date.now() < blockTime) {
        return true;
    }
    blockedIPs.delete(ip);
    return false;
};

const trackSuspiciousActivity = (ip, activity) => {
    if (!suspiciousActivity.has(ip)) {
        suspiciousActivity.set(ip, []);
    }
    
    const activities = suspiciousActivity.get(ip);
    activities.push({ activity, timestamp: Date.now() });
    
    // Keep only last 10 activities
    if (activities.length > 10) {
        activities.shift();
    }
    
    // Check for suspicious patterns
    const recentActivities = activities.filter(a => Date.now() - a.timestamp < 5 * 60 * 1000);
    if (recentActivities.length > 5) {
        blockIP(ip);
    }
};

// IP blocking middleware
const ipBlockingMiddleware = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (isIPBlocked(clientIP)) {
        return res.status(403).json({
            error: 'IP address is temporarily blocked due to suspicious activity'
        });
    }
    
    next();
};

// Request validation middleware
const validateRequest = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check for common attack patterns
    const suspiciousPatterns = [
        /script/i,
        /javascript/i,
        /vbscript/i,
        /onload/i,
        /onerror/i,
        /<script>/i,
        /exec/i,
        /eval/i,
        /union.*select/i,
        /drop.*table/i,
        /insert.*into/i,
        /delete.*from/i
    ];
    
    const requestString = JSON.stringify(req.body) + req.url + JSON.stringify(req.query);
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestString)) {
            trackSuspiciousActivity(clientIP, 'malicious_payload');
            return res.status(400).json({
                error: 'Request contains potentially malicious content'
            });
        }
    }
    
    next();
};

// Enhanced JWT validation
const enhancedJWTValidation = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user still exists and is active
        const userQuery = 'SELECT id, username, email, is_active, role FROM users WHERE id = $1';
        const userResult = await pool.query(userQuery, [decoded.id]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        if (!user.is_active) {
            return res.status(401).json({ error: 'User account is deactivated' });
        }
        
        // Check token expiration
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return res.status(401).json({ error: 'Token expired' });
        }
        
        // Add user info to request
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        };
        
        next();
    } catch (error) {
        console.error('JWT validation error:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        return res.status(401).json({ error: 'Token validation failed' });
    }
};

// Role-based access control
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.trim().replace(/[<>]/g, '');
        }
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                obj[key] = sanitize(obj[key]);
            }
        }
        return obj;
    };
    
    if (req.body) {
        req.body = sanitize(req.body);
    }
    
    if (req.query) {
        req.query = sanitize(req.query);
    }
    
    next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const method = req.method;
    const url = req.originalUrl;
    const timestamp = new Date().toISOString();
    
    // Log sensitive operations
    const sensitiveEndpoints = ['/api/auth', '/api/users', '/api/admin'];
    const isSensitive = sensitiveEndpoints.some(endpoint => url.startsWith(endpoint));
    
    if (isSensitive || method !== 'GET') {
        console.log(`🔐 [${timestamp}] ${method} ${url} - IP: ${clientIP} - UA: ${userAgent}`);
    }
    
    next();
};

// File upload security
const validateFileUpload = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return next();
    }
    
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/csv',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'application/x-rar-compressed'
    ];
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    for (const file of req.files) {
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({
                error: `File type ${file.mimetype} is not allowed`
            });
        }
        
        if (file.size > maxSize) {
            return res.status(400).json({
                error: `File ${file.originalname} exceeds maximum size of 10MB`
            });
        }
        
        // Check for suspicious file names
        const suspiciousPatterns = [
            /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.com$/i, /\.scr$/i,
            /\.vbs$/i, /\.js$/i, /\.jar$/i, /\.php$/i, /\.asp$/i
        ];
        
        const hasSuspiciousName = suspiciousPatterns.some(pattern => 
            pattern.test(file.originalname)
        );
        
        if (hasSuspiciousName) {
            return res.status(400).json({
                error: `File ${file.originalname} has a suspicious extension`
            });
        }
    }
    
    next();
};

// Session management
const sessionStore = new Map();

const createSession = (userId, token) => {
    const sessionId = `session_${userId}_${Date.now()}`;
    sessionStore.set(sessionId, {
        userId,
        token,
        createdAt: Date.now(),
        lastActivity: Date.now()
    });
    return sessionId;
};

const validateSession = (req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
        return next();
    }
    
    const session = sessionStore.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Check session timeout (24 hours)
    if (Date.now() - session.lastActivity > 24 * 60 * 60 * 1000) {
        sessionStore.delete(sessionId);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    
    next();
};

module.exports = {
    rateLimits,
    ipBlockingMiddleware,
    validateRequest,
    enhancedJWTValidation,
    requireRole,
    sanitizeInput,
    securityLogger,
    validateFileUpload,
    createSession,
    validateSession,
    blockIP,
    isIPBlocked
};