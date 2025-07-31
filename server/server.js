const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');
const fileRoutes = require('./routes/files');
const schedulerService = require('./services/schedulerService');
const auditService = require('./services/auditService');
const {
    rateLimits,
    ipBlockingMiddleware,
    validateRequest,
    securityLogger,
    sanitizeInput
} = require('./middleware/securityMiddleware');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:8080",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// Trust proxy for correct client IP handling (needed for rate limiting and proxies)
app.set('trust proxy', 1); // Trust first proxy (e.g., Nginx, AWS ELB)

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS middleware - Enhanced configuration
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:8080',
    'http://54.80.7.27',
    'http://172.31.36.218',
    'https://task-cbvc.vercel.app',
    'https://task.vercel.app'
].filter(Boolean).map(url => url.trim());

// Add any additional origins from environment
if (process.env.ALLOWED_ORIGINS) {
    const extraOrigins = process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim());
    allowedOrigins.push(...extraOrigins);
}

console.log('🔧 CORS Allowed Origins:', allowedOrigins);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Allow all origins in development
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Check if origin matches patterns (for dynamic subdomains)
        const allowedPatterns = [
            /^https?:\/\/localhost(:\d+)?$/,
            /^https?:\/\/.*\.vercel\.app$/,
            /^https?:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/ // Allow IP addresses
        ];
        
        if (allowedPatterns.some(pattern => pattern.test(origin))) {
            return callback(null, true);
        }
        
        console.warn('⚠️ CORS blocked origin:', origin);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
}));

// Security middleware
app.use(ipBlockingMiddleware);
app.use(securityLogger);
app.use(validateRequest);
app.use(sanitizeInput);

// Rate limiting - general API
app.use('/api/', rateLimits.api);

// Specific rate limits for auth endpoints
app.use('/api/auth', rateLimits.auth);

// Rate limiting for file uploads
app.use('/api/files/upload', rateLimits.upload);

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('public'));

// Make io available to routes
app.set('io', io);

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);
    
    // Join user to their own room for private notifications
    socket.on('join-user-room', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`👤 User ${userId} joined their room`);
    });
    
    // Join task room for task-specific updates
    socket.on('join-task-room', (taskId) => {
        socket.join(`task-${taskId}`);
        console.log(`📋 User joined task room: ${taskId}`);
    });
    
    // Leave task room
    socket.on('leave-task-room', (taskId) => {
        socket.leave(`task-${taskId}`);
        console.log(`📋 User left task room: ${taskId}`);
    });
    
    socket.on('disconnect', () => {
        console.log('👤 User disconnected:', socket.id);
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/files', fileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: Object.values(err.errors).map(e => e.message)
        });
    }
    
    // JWT error
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Default error
    res.status(err.status || 500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Initialize database and start server
const startServer = async () => {
    try {
        await initDatabase();
        
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
            console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
            
            // Start scheduler service
            schedulerService.start();
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            schedulerService.stop();
            server.close(() => {
                console.log('Process terminated');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// For Vercel serverless deployment
if (process.env.VERCEL) {
    // Initialize database for serverless
    initDatabase().catch(error => {
        console.error('❌ Database initialization failed:', error);
    });
    
    // Export the app for Vercel
    module.exports = app;
} else {
    // Start server only if not in test mode
    if (process.env.NODE_ENV !== 'test') {
        startServer();
    }
    module.exports = app;
}