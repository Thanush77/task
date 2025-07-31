#!/bin/bash

echo "🚀 Deploying TaskFlow Analytics to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Build client assets
echo "📦 Building client assets..."
cd client
npm install --production
npm run build 2>/dev/null || echo "No build script found, using static files"
cd ..

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install --production
cd ..

# Set up environment variables
echo "🔧 Setting up environment variables..."
echo "Please set the following environment variables in Vercel dashboard:"
echo "- DATABASE_URL (PostgreSQL connection string)"
echo "- JWT_SECRET"
echo "- NODE_ENV=production"
echo "- FRONTEND_URL (your Vercel domain)"

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo "📝 Don't forget to:"
echo "   1. Set up your PostgreSQL database"
echo "   2. Configure environment variables in Vercel dashboard"
echo "   3. Update CORS settings if needed"