# TaskFlow Analytics - Production Deployment Guide for 54.80.7.27

## 🚀 Overview

This guide will help you deploy TaskFlow Analytics to your production server at IP 54.80.7.27. The application includes advanced analytics, real-time updates, and comprehensive reporting features.

## 📋 Prerequisites

### Server Requirements
- Ubuntu/CentOS/RHEL Linux server
- Node.js 16+ and npm
- PostgreSQL 12+
- Nginx (recommended)
- PM2 for process management
- At least 2GB RAM and 20GB storage

### Domain Setup (Optional)
- Point your domain to 54.80.7.27
- Update DNS A record

## 🔧 Step 1: Server Preparation

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
# or for CentOS/RHEL:
# sudo yum update -y
```

### 1.2 Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 1.3 Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 1.4 Install Nginx (Optional but Recommended)
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.5 Install PM2 Globally
```bash
sudo npm install -g pm2
```

## 📁 Step 2: Deploy Application

### 2.1 Upload Files to Server
Upload the `taskflow-app` directory to your server:

```bash
# On your local machine, zip the project
tar -czf taskflow-app.tar.gz taskflow-app/

# Upload to server (replace 'user' with your username)
scp taskflow-app.tar.gz user@54.80.7.27:~/

# On server, extract
cd ~
tar -xzf taskflow-app.tar.gz
cd taskflow-app
```

### 2.2 Run Deployment Script
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

**OR** for Docker deployment:
```bash
chmod +x deploy-docker.sh
./deploy-docker.sh
```

## ⚙️ Step 3: Database Setup

### 3.1 Create Database and User
```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE taskflow_prod;
CREATE USER taskflow_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE taskflow_prod TO taskflow_user;
\q
```

### 3.2 Run Database Migrations
```bash
cd server
export DATABASE_URL="postgresql://taskflow_user:your_secure_password@localhost:5432/taskflow_prod"
```

Then run the SQL files in `server/migrations/` in order:
```bash
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_add_indexes.sql
# ... run all migration files
```

## 🔐 Step 4: Environment Configuration

### 4.1 Configure Environment Variables
Edit the `.env` file:

```bash
nano .env
```

**Critical settings for 54.80.7.27:**
```env
# Database
DATABASE_URL=postgresql://taskflow_user:your_secure_password@localhost:5432/taskflow_prod

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Frontend URLs
FRONTEND_URL=http://54.80.7.27
CLIENT_URL=http://54.80.7.27

# Security (IMPORTANT: Generate strong secrets!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
REFRESH_TOKEN_SECRET=your-refresh-token-secret-minimum-32-characters-long

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4.2 Generate Secure Keys
```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🌐 Step 5: Client Build and Configuration

### 5.1 Build Client for Production
```bash
cd client
npm install
npm run build
```

### 5.2 Verify Build Output
Check that `public/` directory contains:
- ✅ `index.html` (updated with minified references)
- ✅ `js/app.min.js` (all JavaScript minified)
- ✅ `css/styles.min.css` (all CSS minified)
- ✅ `manifest.json`, `sw.js`
- ✅ `images/`, `assets/` directories

## 🔧 Step 6: Nginx Configuration (Recommended)

### 6.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/taskflow
```

Copy the content from `taskflow-nginx.conf` or use:

```nginx
server {
    listen 80;
    server_name 54.80.7.27;
    
    # Serve static files from client/public
    location / {
        root /home/your-user/taskflow-app/client/public;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
    
    # Proxy API requests to Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🚀 Step 7: Start Application

### 7.1 Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7.2 Verify Application
```bash
# Check PM2 status
pm2 status

# Check application health
curl http://localhost:3000/api/health

# Check full application
curl http://54.80.7.27/api/health
```

## 🔒 Step 8: Security & SSL (Recommended)

### 8.1 Install Certbot for SSL
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 8.2 Get SSL Certificate (if you have a domain)
```bash
sudo certbot --nginx -d your-domain.com
```

### 8.3 Configure Firewall
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## 📊 Step 9: Verify Deployment

### 9.1 Test All Features
1. **Frontend**: Visit http://54.80.7.27
2. **API Health**: http://54.80.7.27/api/health  
3. **Registration**: Create a test account
4. **Analytics**: Go to Reports tab and verify charts load
5. **Real-time**: Test task creation and updates
6. **Export**: Test PDF, Excel, CSV exports

### 9.2 Performance Check
```bash
# Check memory usage
free -h

# Check disk space
df -h

# Check PM2 logs
pm2 logs

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
```

## 🔄 Step 10: Maintenance & Monitoring

### 10.1 Set Up Automated Backups
```bash
# Add to crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /home/your-user/taskflow-app/backup.sh
```

### 10.2 Monitor Application
```bash
# Check application health
./health-check.sh

# View logs
pm2 logs taskflow-analytics

# Monitor system resources
htop
```

### 10.3 Update Application
```bash
# Stop application
pm2 stop taskflow-analytics

# Pull updates (if using git)
git pull origin main

# Rebuild client
cd client && npm run build && cd ..

# Restart application
pm2 restart taskflow-analytics
```

## 📱 Step 11: Access Your Application

### 🌐 URLs:
- **Main Application**: http://54.80.7.27
- **API Health Check**: http://54.80.7.27/api/health
- **Analytics Dashboard**: http://54.80.7.27 (Reports tab)

### 🔑 Default Login:
Create your admin account through the registration form on first visit.

## 🎯 Advanced Features Available

✅ **Real-time Dashboard** with live updates  
✅ **Predictive Analytics** with velocity tracking  
✅ **Advanced Report Generation** (PDF, Excel, CSV)  
✅ **Team Performance Metrics**  
✅ **Time Tracking** with start/pause/stop functionality  
✅ **WebSocket Real-time Updates**  
✅ **Comprehensive Export System**  
✅ **Task Assignment Notifications**  
✅ **Deadline Alerts and Overdue Tracking**  

## 🆘 Troubleshooting

### Common Issues:

1. **Port 3000 not accessible**
   ```bash
   sudo netstat -tlnp | grep 3000
   pm2 status
   ```

2. **Database connection failed**
   ```bash
   sudo systemctl status postgresql
   psql -h localhost -U taskflow_user -d taskflow_prod
   ```

3. **Nginx not serving files**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **Build issues**
   ```bash
   cd client
   rm -rf node_modules public
   npm install
   npm run build
   ```

### Log Files:
- Application: `pm2 logs taskflow-analytics`
- Nginx: `/var/log/nginx/access.log`
- System: `/var/log/syslog`

## 📞 Support

If you encounter issues:
1. Check the logs: `pm2 logs`
2. Verify environment variables: `cat .env`
3. Test database connection: `./health-check.sh`
4. Check disk space: `df -h`

## 🎉 Congratulations!

Your TaskFlow Analytics application with advanced analytics and reporting is now deployed and running on 54.80.7.27! 

The application includes enterprise-level features like predictive analytics, real-time collaboration, and comprehensive reporting - all optimized for your production environment.

Happy task managing! 🚀