# TaskFlow Deployment Guide

This guide helps you deploy the enhanced TaskFlow application to your server.

## 🚀 Quick Deployment

### Step 1: Update Server IP (If Needed)
Edit the deployment scripts if your server IP is different:
```bash
# In deploy.sh and server-manager.sh, update this line:
SERVER_HOST="your-actual-server-ip-or-hostname"
```

### Step 2: Deploy to Server
Run the deployment script:
```bash
./deploy.sh
```

This will:
- ✅ Test SSH connection
- ✅ Create backup of current deployment
- ✅ Push code to GitHub (if possible)
- ✅ Upload files to server
- ✅ Update .env file
- ✅ Install dependencies
- ✅ Restart server

### Step 3: Verify Deployment
Check if the server is running:
```bash
./server-manager.sh status
```

## 🛠️ Server Management

### Available Commands
```bash
./server-manager.sh status    # Check server status
./server-manager.sh start     # Start server
./server-manager.sh stop      # Stop server
./server-manager.sh restart   # Restart server
./server-manager.sh logs      # View live logs
./server-manager.sh install   # Install dependencies
./server-manager.sh connect   # SSH into server
```

### Manual Deployment (If Scripts Don't Work)

1. **Connect to server:**
   ```bash
   ssh -i /Users/thanush/Desktop/thanush.pem ubuntu@your-server-ip
   ```

2. **Navigate to project directory:**
   ```bash
   cd ~/task/task
   ```

3. **Pull latest code:**
   ```bash
   git pull origin main
   ```

4. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

5. **Update .env file:**
   ```bash
   # Copy the .env.production content to server/.env
   nano .env
   ```

6. **Start server:**
   ```bash
   # Stop existing process
   pkill -f 'node.*server.js' || true
   
   # Start server
   nohup npm start > logs/app.log 2>&1 &
   ```

## 📋 What's New in This Deployment

### ✨ Enhanced Features:
- **Advanced Analytics Dashboard** - Real-time charts and metrics
- **Email Notifications** - Professional HTML templates for all events
- **WebSocket Real-time Updates** - Live collaboration features
- **File Upload System** - Secure file attachments for tasks
- **Advanced Security** - Rate limiting, audit logs, IP blocking
- **Task Assignment Tracking** - Shows who assigned tasks and when
- **5-Level Priority System** - Enhanced task prioritization
- **Scheduled Reminders** - Automated email notifications
- **Enhanced UI/UX** - Modern glassmorphism design

### 🔧 Technical Improvements:
- **Production-ready security** with comprehensive middleware
- **Audit logging** for all user actions
- **Database migrations** for new features
- **Error handling** and logging improvements
- **Performance optimizations** with proper indexing
- **Real-time notifications** via WebSocket
- **Responsive design** for all screen sizes

## 🔒 Security Features

- **Rate limiting** on all endpoints
- **IP blocking** for suspicious activity
- **Input validation** and sanitization
- **JWT token** security enhancements
- **File upload** security validation
- **Audit logging** for compliance
- **CORS** configuration for security

## 📊 Environment Variables

The `.env.production` file includes:
- Database connection to AWS RDS
- SMTP configuration for Gmail
- Security settings for production
- JWT secrets and expiration
- File upload configurations

## 🎯 Post-Deployment Checklist

After deployment, verify:
- [ ] Server is running on port 3000
- [ ] Database connection is working
- [ ] Email notifications are sending
- [ ] File uploads are working
- [ ] WebSocket connections are established
- [ ] All security features are active
- [ ] Analytics dashboard is loading
- [ ] Task assignment tracking is working

## 🆘 Troubleshooting

### Server Won't Start:
```bash
./server-manager.sh logs  # Check error logs
./server-manager.sh restart  # Try restarting
```

### Database Connection Issues:
- Check AWS RDS security groups
- Verify database credentials in .env
- Ensure database is running

### Email Not Sending:
- Check SMTP credentials in .env
- Verify Gmail app password
- Check server firewall for port 587

### File Upload Issues:
- Check uploads directory permissions
- Verify file size limits
- Check disk space on server

## 📞 Support

If you encounter issues:
1. Check the logs: `./server-manager.sh logs`
2. Verify server status: `./server-manager.sh status`
3. Try restarting: `./server-manager.sh restart`
4. Check database connectivity
5. Verify all environment variables

---

🎉 **Your TaskFlow application is now deployed with all advanced features!**