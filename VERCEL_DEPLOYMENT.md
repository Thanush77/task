# TaskFlow Analytics - Vercel Deployment Guide

## 🚀 Enhanced Features

This version includes advanced analytics and reporting capabilities:

### ✨ New Analytics Features
- **Real-time Dashboard** with live updates
- **Predictive Analytics** with velocity tracking and completion forecasting
- **Advanced Report Generation** (PDF, Excel, CSV) with charts
- **Team Performance Metrics** with detailed insights
- **Time Analytics** with efficiency tracking
- **Workload Distribution** analysis
- **Overdue Task Monitoring**

### 📊 Export Capabilities
- **PDF Reports** with professional formatting and charts
- **Excel Exports** with multiple sheets and styling
- **CSV Exports** for data analysis
- **Real-time Report Updates**

## 🔧 Deployment Steps

### 1. Prerequisites
- Node.js 14+ installed
- PostgreSQL database (recommend Neon, Supabase, or PlanetScale)
- Vercel account

### 2. Database Setup
Create a PostgreSQL database and run the initialization scripts:
```sql
-- Run the SQL files in server/migrations/ to set up tables
-- Ensure you have the latest schema with analytics support
```

### 3. Environment Variables
Configure these in your Vercel dashboard:

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Authentication
JWT_SECRET=your-super-secret-jwt-key-32-chars-min
REFRESH_TOKEN_SECRET=your-refresh-token-secret-key

# Application
NODE_ENV=production
FRONTEND_URL=https://your-app-name.vercel.app

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### Option B: GitHub Integration
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### 5. Post-Deployment Configuration

#### Database Connection
Ensure your PostgreSQL database allows connections from Vercel's IP ranges.

#### CORS Configuration
The app is configured to work with your Vercel domain. Update `FRONTEND_URL` if needed.

#### SSL Configuration
Vercel automatically provides SSL certificates.

## 📈 Analytics Features

### Real-Time Dashboard
- Live task updates
- Team member activity
- Upcoming deadlines
- Performance metrics

### Advanced Reports
Access via `/reports` tab:
- Task statistics with interactive charts
- Team performance analysis
- Time tracking analytics
- Predictive completion forecasting
- Export capabilities (PDF, Excel, CSV)

### New API Endpoints
- `GET /api/reports/predictive-analytics` - Velocity and forecasting
- `GET /api/reports/real-time-dashboard` - Live dashboard data
- `GET /api/reports/export` - Enhanced export with Excel support

## 🔍 Monitoring & Maintenance

### Health Check
- Endpoint: `https://your-app.vercel.app/api/health`
- Monitor server status and database connectivity

### Logs
- View logs in Vercel dashboard
- Monitor performance and errors
- Set up alerts for critical issues

### Database Maintenance
- Regular backups
- Monitor connection pools
- Index optimization for analytics queries

## 🛠 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check firewall settings
   - Ensure SSL is enabled if required

2. **CORS Errors**
   - Update FRONTEND_URL in environment variables
   - Check domain configuration

3. **Analytics Not Loading**
   - Verify all analytics endpoints are accessible
   - Check browser console for JavaScript errors
   - Ensure Chart.js is loading properly

4. **Export Functionality Issues**
   - Check file permissions
   - Verify all export dependencies are installed
   - Monitor memory usage for large exports

### Performance Optimization

1. **Database Optimization**
   - Add indexes for frequently queried columns
   - Use connection pooling
   - Monitor query performance

2. **Frontend Optimization**
   - Enable compression
   - Optimize chart rendering
   - Implement lazy loading for large datasets

3. **Serverless Optimization**
   - Minimize cold starts
   - Optimize bundle size
   - Use edge functions for static content

## 📚 API Documentation

### Analytics Endpoints
- `GET /api/reports/overview-stats` - General statistics
- `GET /api/reports/team-performance` - Team metrics
- `GET /api/reports/time-analytics` - Time tracking data
- `GET /api/reports/workload-distribution` - Task distribution
- `GET /api/reports/predictive-analytics` - Forecasting data
- `GET /api/reports/real-time-dashboard` - Live dashboard

### Export Endpoints
- `GET /api/reports/export?type=csv&report=comprehensive`
- `GET /api/reports/export?type=excel&report=team-performance`
- `GET /api/reports/export?type=pdf&report=comprehensive`

## 🔐 Security Considerations

- All API endpoints require authentication
- Rate limiting is enforced
- Input validation and sanitization
- HTTPS enforced in production
- Secure JWT token handling

## 🎯 Next Steps

After deployment:
1. Create admin user account
2. Configure team members
3. Set up initial projects and tasks
4. Explore analytics dashboard
5. Test export functionality
6. Set up monitoring and alerts

## 📞 Support

For deployment issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test database connectivity
4. Review CORS configuration

Happy deploying! 🚀