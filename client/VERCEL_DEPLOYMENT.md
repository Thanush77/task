# TaskFlow Client - Vercel Deployment Guide

## Overview
This guide will help you deploy the TaskFlow client application to Vercel.

## Prerequisites
- Node.js installed
- Vercel account (free at [vercel.com](https://vercel.com))
- Git repository (optional but recommended)


## Deployment Methods

### Method 1: Using the Deployment Script
```bash
# Make sure you're in the client directory
cd taskflow-app/client

# Run the deployment script
./deploy-vercel.sh
```

### Method 2: Manual CLI Installation
```bash
# Install Vercel CLI globally
npm install -g vercel

# Build the project
npm run build

# Deploy to Vercel
vercel --prod
```

### Method 3: Using npx (if CLI installation fails)
```bash
# Build the project
npm run build

# Deploy using npx
npx vercel --prod
```

### Method 4: Web Interface Deployment
1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login with your GitHub account
3. Click "New Project"
4. Import your repository
5. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `taskflow-app/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `public`
   - **Install Command**: `npm install`

## Configuration Files

### vercel.json
The project includes a `vercel.json` configuration file that:
- Sets up static file serving
- Configures routing for SPA (Single Page Application)
- Adds security headers
- Handles service worker caching

### .vercelignore
Excludes unnecessary files from deployment:
- `node_modules/`
- Development files
- Log files
- Environment files

## Environment Variables
If your application needs environment variables, add them in the Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add any required variables

## Custom Domain (Optional)
1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Follow the DNS configuration instructions

## Troubleshooting

### npm Cache Issues
If you encounter npm cache issues:
```bash
# Clear npm cache
npm cache clean --force

# Remove problematic cache directory
rm -rf ~/.npm/_cacache/content-v2/sha512/60/a8
```

### Permission Issues
If you get permission errors:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Build Failures
1. Check that all dependencies are installed: `npm install`
2. Verify the build command works locally: `npm run build`
3. Check the build logs in Vercel dashboard

## Post-Deployment

### Verify Deployment
1. Check that your site loads correctly
2. Test all functionality
3. Verify that static assets are loading
4. Check service worker functionality

### Monitoring
- Use Vercel Analytics (if enabled)
- Monitor performance in Vercel dashboard
- Set up error tracking if needed

## Updates and Redeployment
To update your deployment:
1. Make your changes
2. Commit to git (if using Git integration)
3. Push to trigger automatic deployment
4. Or run the deployment script again

## Support
- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Vercel Community: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions) 