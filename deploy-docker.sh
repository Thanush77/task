#!/bin/bash

# TaskFlow Analytics - Docker Deployment Script for 54.80.7.27
echo "🐳 Starting TaskFlow Analytics Docker Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Install Docker: curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    if [ -f .env.docker ]; then
        cp .env.docker .env
        print_warning "Created .env from .env.docker template. Please edit it with your actual values."
        print_warning "You must set DB_PASSWORD, JWT_SECRET, and REFRESH_TOKEN_SECRET"
        echo ""
        read -p "Have you configured the .env file with secure passwords and secrets? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Please configure .env file and run this script again."
            exit 1
        fi
    else
        print_error ".env file not found. Please create it with required environment variables."
        exit 1
    fi
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p uploads logs ssl

# Set proper permissions
chmod 755 uploads logs
chmod 600 .env

# Build and start services
print_status "Building and starting Docker services..."
docker-compose -f docker-compose.prod.yml build

if [ $? -ne 0 ]; then
    print_error "Docker build failed"
    exit 1
fi

print_status "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

if [ $? -ne 0 ]; then
    print_error "Failed to start services"
    exit 1
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Check service health
print_status "Checking service health..."
docker-compose -f docker-compose.prod.yml ps

# Test database connection
print_status "Testing database connection..."
if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U taskflow_user -d taskflow_prod; then
    print_status "Database is ready!"
else
    print_error "Database is not ready. Check logs: docker-compose -f docker-compose.prod.yml logs postgres"
fi

# Test application health
print_status "Testing application health..."
sleep 10
if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    print_status "Application is healthy!"
else
    print_warning "Application health check failed. It might still be starting up."
fi

# Create backup script for Docker
print_status "Creating Docker backup script..."
cat > backup-docker.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U taskflow_user taskflow_prod > $BACKUP_DIR/database_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# Keep only last 7 backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Docker backup completed: $DATE"
EOF

chmod +x backup-docker.sh

# Create management scripts
print_status "Creating management scripts..."

# Restart script
cat > restart-app.sh << 'EOF'
#!/bin/bash
echo "Restarting TaskFlow Analytics..."
docker-compose -f docker-compose.prod.yml restart taskflow-app
echo "Application restarted!"
EOF

# Update script
cat > update-app.sh << 'EOF'
#!/bin/bash
echo "Updating TaskFlow Analytics..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
echo "Application updated!"
EOF

# Logs script
cat > view-logs.sh << 'EOF'
#!/bin/bash
docker-compose -f docker-compose.prod.yml logs -f taskflow-app
EOF

chmod +x restart-app.sh update-app.sh view-logs.sh

# Display final status
echo ""
print_status "🎉 Docker deployment completed successfully!"
echo ""
echo "📋 Service Status:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "🌐 Application URLs:"
echo "- Frontend: http://54.80.7.27"
echo "- API Health: http://54.80.7.27/health"
echo "- Direct API: http://54.80.7.27:3000/api/health"
echo "- Analytics: http://54.80.7.27 (Reports tab)"
echo ""
echo "🔧 Management Commands:"
echo "- View logs: ./view-logs.sh"
echo "- Restart app: ./restart-app.sh"
echo "- Update app: ./update-app.sh"
echo "- Stop all: docker-compose -f docker-compose.prod.yml down"
echo "- Backup: ./backup-docker.sh"
echo ""
echo "📊 Monitor containers:"
echo "- docker-compose -f docker-compose.prod.yml ps"
echo "- docker-compose -f docker-compose.prod.yml logs [service-name]"
echo ""
echo "🔒 Security Notes:"
echo "- Configure SSL certificates in ./ssl/ directory"
echo "- Set up firewall to allow only ports 80, 443"
echo "- Regularly update containers and backup data"
echo ""
print_status "Happy task managing with Docker! 🐳"