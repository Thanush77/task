#!/bin/bash

echo "🔧 Setting up environment for AWS deployment..."

# Create .env file for AWS RDS configuration
cat > .env << EOF
# Database Configuration (AWS RDS)
DATABASE_URL=postgresql://thanush:your_password@task.cb4e4w6y2od4.us-east-1.rds.amazonaws.com:5432/task
DB_HOST=task.cb4e4w6y2od4.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=task
DB_USER=thanush
DB_PASSWORD=your_password_here

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Frontend URLs (add all allowed origins)
FRONTEND_URL=http://172.31.36.218
CLIENT_URL=http://172.31.36.218
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://task-cbvc.vercel.app

# Authentication (Generate secure keys!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRE=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret-minimum-32-characters-long
REFRESH_TOKEN_EXPIRE=30d

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Email (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=10MB
UPLOAD_PATH=./uploads

# Analytics
ANALYTICS_RETENTION_DAYS=365
REPORT_GENERATION_TIMEOUT=30000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF

echo "✅ Created .env file template"
echo ""
echo "⚠️  IMPORTANT: Edit the .env file and:"
echo "   1. Replace 'your_password_here' with your actual RDS password"
echo "   2. Generate secure JWT secrets using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo "   3. Update FRONTEND_URL with your actual server IP or domain"
echo ""
echo "📝 To edit: nano .env"
echo ""
echo "🚀 After editing .env, restart the server: npm run dev"