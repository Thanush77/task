const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user still exists and is active
        const result = await pool.query(
            'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        
        if (!user.is_active) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token expired' });
        }
        
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRoles = Array.isArray(roles) ? roles : [roles];
        
        if (userRoles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ 
                error: 'Insufficient permissions',
                required: userRoles,
                current: req.user.role
            });
        }
    };
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const result = await pool.query(
                'SELECT id, username, email, full_name, role FROM users WHERE id = $1 AND is_active = true',
                [decoded.id]
            );

            if (result.rows.length > 0) {
                req.user = result.rows[0];
            }
        }
        
        next();
    } catch (error) {
        // For optional auth, we continue even if token is invalid
        next();
    }
};

module.exports = { 
    authenticateToken, 
    requireRole, 
    optionalAuth 
};
