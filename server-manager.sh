#!/bin/bash

# TaskFlow Server Manager Script
# This script helps manage the TaskFlow server

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="YOUR_SERVER_PUBLIC_IP"  # Replace with your actual server IP/hostname
SSH_KEY="/Users/thanush/Desktop/thanush.pem"
SERVER_PATH="~/task/task"

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

# Function to execute command on server
execute_on_server() {
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "$1"
}

# Function to show server status
show_status() {
    print_status "Checking server status..."
    execute_on_server "
        cd $SERVER_PATH/server
        if pgrep -f 'node.*server.js' > /dev/null; then
            echo '✅ Server is running'
            echo 'Process ID:' \$(pgrep -f 'node.*server.js')
        else
            echo '❌ Server is not running'
        fi
        
        echo ''
        echo 'Recent logs:'
        tail -n 10 logs/app.log 2>/dev/null || echo 'No logs found'
    "
}

# Function to start server
start_server() {
    print_status "Starting server..."
    execute_on_server "
        cd $SERVER_PATH/server
        if pgrep -f 'node.*server.js' > /dev/null; then
            echo 'Server is already running'
        else
            nohup npm start > logs/app.log 2>&1 &
            sleep 2
            if pgrep -f 'node.*server.js' > /dev/null; then
                echo '✅ Server started successfully'
            else
                echo '❌ Failed to start server'
                tail -n 20 logs/app.log
            fi
        fi
    "
}

# Function to stop server
stop_server() {
    print_status "Stopping server..."
    execute_on_server "
        cd $SERVER_PATH/server
        pkill -f 'node.*server.js' || true
        sleep 2
        if pgrep -f 'node.*server.js' > /dev/null; then
            echo '❌ Server is still running'
        else
            echo '✅ Server stopped successfully'
        fi
    "
}

# Function to restart server
restart_server() {
    print_status "Restarting server..."
    stop_server
    sleep 2
    start_server
}

# Function to show logs
show_logs() {
    print_status "Showing server logs..."
    execute_on_server "
        cd $SERVER_PATH/server
        if [ -f logs/app.log ]; then
            tail -f logs/app.log
        else
            echo 'No logs found'
        fi
    "
}

# Function to install dependencies
install_deps() {
    print_status "Installing dependencies..."
    execute_on_server "
        cd $SERVER_PATH/server
        npm install
        echo '✅ Dependencies installed'
    "
}

# Function to connect to server
connect_to_server() {
    print_status "Connecting to server..."
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST"
}

# Function to show help
show_help() {
    echo "TaskFlow Server Manager"
    echo "======================"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  status      - Show server status"
    echo "  start       - Start the server"
    echo "  stop        - Stop the server"
    echo "  restart     - Restart the server"
    echo "  logs        - Show server logs (Press Ctrl+C to exit)"
    echo "  install     - Install dependencies"
    echo "  connect     - Connect to server via SSH"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 restart"
    echo "  $0 logs"
}

# Main script logic
case "$1" in
    "status")
        show_status
        ;;
    "start")
        start_server
        ;;
    "stop")
        stop_server
        ;;
    "restart")
        restart_server
        ;;
    "logs")
        show_logs
        ;;
    "install")
        install_deps
        ;;
    "connect")
        connect_to_server
        ;;
    "help"|""|"--help"|"-h")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac