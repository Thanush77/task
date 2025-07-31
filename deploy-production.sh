#!/bin/bash

# TaskFlow Analytics - Production Deployment Script for 54.80.7.27
echo "🚀 Starting TaskFlow Analytics Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons."
   exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 14+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL client not found. Make sure PostgreSQL is installed and accessible."
fi

# Check if PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2 globally..."
    sudo npm install -g pm2
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p uploads
chmod 755 uploads

# Set up environment
print_status "Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.production .env
    print_warning "Created .env from .env.production template. Please edit it with your actual values."
else
    print_status ".env file already exists."
fi

# Install server dependencies
print_status "Installing server dependencies..."
cd server
npm install --production
if [ $? -ne 0 ]; then
    print_error "Failed to install server dependencies"
    exit 1
fi
cd ..

# Install client dependencies and build (if needed)
print_status "Setting up client..."
cd client
if [ -f package.json ]; then
    npm install
    # Try to build if build script exists
    if npm run build 2>/dev/null; then
        print_status "Client build completed successfully"
        print_status "Built files are in client/public/ directory"
    else
        print_status "No build script found, using static files"
        # Create public directory and copy files if build failed
        mkdir -p public
        cp -r *.html *.js *.css public/ 2>/dev/null || true
    fi
fi
cd ..

# Database setup
print_status "Setting up database..."
echo "Please run the following SQL commands in your PostgreSQL database:"
echo "1. CREATE DATABASE taskflow_prod;"
echo "2. Run all migration files from server/migrations/"
echo ""
read -p "Have you set up the database? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Please set up the database and run this script again."
    exit 1
fi

# Test database connection
print_status "Testing database connection..."
cd server
if node -e "
const { pool } = require('./config/database');
pool.query('SELECT NOW()', (err, result) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    } else {
        console.log('Database connection successful!');
        process.exit(0);
    }
});
" 2>/dev/null; then
    print_status "Database connection successful!"
else
    print_error "Database connection failed. Please check your DATABASE_URL in .env"
    cd ..
    exit 1
fi
cd ..

# Set up Nginx configuration (optional)
print_status "Setting up Nginx configuration..."
cat > taskflow-nginx.conf << EOF
server {
    listen 80;
    server_name 54.80.7.27;
    
    # Serve static files from built directory
    location / {
        root $(pwd)/client/public;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }
    
    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

print_status "Nginx configuration created as taskflow-nginx.conf"
print_warning "To use Nginx, copy this file to /etc/nginx/sites-available/ and enable it"

# Create PM2 ecosystem file
print_status "Creating PM2 ecosystem file..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'taskflow-analytics',
    script: './server/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
print_status "Setting up PM2 startup script..."
pm2 startup
print_warning "Run the command above as root to enable PM2 startup"

# Create health check script
print_status "Creating health check script..."
cat > health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ TaskFlow is healthy"
    exit 0
else
    echo "❌ TaskFlow health check failed (HTTP $RESPONSE)"
    # Restart the application
    pm2 restart taskflow-analytics
    exit 1
fi
EOF

chmod +x health-check.sh

# Set up crontab for health checks (optional)
print_status "Health check script created. To set up automated health checks, add to crontab:"
echo "*/5 * * * * $(pwd)/health-check.sh >> $(pwd)/logs/health.log 2>&1"

# Create backup script
print_status "Creating backup script..."
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DATABASE_URL > $BACKUP_DIR/database_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# Keep only last 7 backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x backup.sh

# Final status check
print_status "Checking application status..."
pm2 status

# Display final instructions
echo ""
print_status "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit .env file with your actual database credentials and secrets"
echo "2. Test the application: http://54.80.7.27:3000"
echo "3. Set up Nginx as reverse proxy (recommended)"
echo "4. Configure SSL certificate for HTTPS"
echo "5. Set up automated backups with: crontab -e"
echo "   Add: 0 2 * * * $(pwd)/backup.sh"
echo ""
echo "🔧 Management Commands:"
echo "- View logs: pm2 logs taskflow-analytics"
echo "- Restart app: pm2 restart taskflow-analytics"
echo "- Stop app: pm2 stop taskflow-analytics"
echo "- Health check: ./health-check.sh"
echo "- Backup: ./backup.sh"
echo ""
echo "🌐 Application URLs:"
echo "- Frontend: http://54.80.7.27"
echo "- API Health: http://54.80.7.27:3000/api/health"
echo "- Analytics: http://54.80.7.27 (Reports tab)"
echo ""
print_status "Happy task managing! 🚀"