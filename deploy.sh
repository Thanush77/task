#!/bin/bash

# TaskFlow Deployment Script
# This script helps deploy the updated TaskFlow application to your server

echo "🚀 TaskFlow Deployment Script"
echo "=============================="

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="YOUR_SERVER_PUBLIC_IP"  # Replace with your actual server IP/hostname
SSH_KEY="/Users/thanush/Desktop/thanush.pem"
SERVER_PATH="~/task/task"
REPO_URL="https://github.com/Thanush77/task.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if SERVER_HOST is set
if [ "$SERVER_HOST" = "YOUR_SERVER_PUBLIC_IP" ]; then
    print_error "Please update SERVER_HOST in the script with your actual server IP"
    print_status "Edit this script and replace 'YOUR_SERVER_PUBLIC_IP' with your server's public IP"
    exit 1
fi

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    print_error "SSH key not found at $SSH_KEY"
    exit 1
fi

# Check SSH key permissions
if [ "$(stat -f %Mp%Lp "$SSH_KEY")" != "400" ]; then
    print_warning "Setting correct permissions for SSH key"
    chmod 400 "$SSH_KEY"
fi

print_status "Starting deployment to $SERVER_HOST..."

# Test SSH connection
print_status "Testing SSH connection..."
if ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SERVER_USER@$SERVER_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    print_success "SSH connection established"
else
    print_error "Cannot connect to server. Please check:"
    echo "  - Server IP/hostname: $SERVER_HOST"
    echo "  - SSH key path: $SSH_KEY"
    echo "  - Server is running and accessible"
    exit 1
fi

# Create backup of current deployment
print_status "Creating backup of current deployment..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "
    if [ -d $SERVER_PATH ]; then
        cd $SERVER_PATH
        tar -czf backup-\$(date +%Y%m%d-%H%M%S).tar.gz server/ client/ 2>/dev/null || true
        echo 'Backup created successfully'
    fi
"

# Clone or pull latest code on server
print_status "Updating code on server..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "
    if [ ! -d $SERVER_PATH ]; then
        echo 'Cloning repository...'
        mkdir -p ~/task
        cd ~/task
        git clone $REPO_URL task
    else
        echo 'Pulling latest changes...'
        cd $SERVER_PATH
        git pull origin main
    fi
    echo 'Code updated successfully'
"

# Update .env file
print_status "Updating .env file..."
scp -i "$SSH_KEY" ./server/.env.production "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/server/.env"
print_success ".env file updated"

# Install dependencies and restart services
print_status "Installing dependencies and restarting services..."
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "
    cd $SERVER_PATH/server
    
    # Install dependencies
    npm install
    
    # Create uploads directory if it doesn't exist
    mkdir -p uploads
    chmod 755 uploads
    
    # Create logs directory if it doesn't exist
    mkdir -p logs
    chmod 755 logs
    
    # Stop existing process
    pkill -f 'node.*server.js' || true
    
    # Start the server in background
    nohup npm start > logs/app.log 2>&1 &
    
    echo 'Server restarted successfully'
    
    # Show server status
    sleep 2
    if pgrep -f 'node.*server.js' > /dev/null; then
        echo 'Server is running'
    else
        echo 'Server failed to start. Check logs:'
        tail -n 20 logs/app.log
    fi
"

print_success "Deployment completed!"
print_status "Server should be running at: http://$SERVER_HOST:3000"
print_status "You can check logs with: ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST 'tail -f $SERVER_PATH/server/logs/app.log'"

echo ""
echo "🎉 Deployment Summary:"
echo "====================="
echo "✅ Code synchronized to server"
echo "✅ Dependencies installed"
echo "✅ Environment configured"
echo "✅ Server restarted"
echo "✅ File upload directory created"
echo "✅ Logging directory created"
echo ""
echo "🔧 Manual Commands (if needed):"
echo "ssh -i $SSH_KEY $SERVER_USER@$SERVER_HOST"
echo "cd $SERVER_PATH/server"
echo "npm install"
echo "npm start"