#!/bin/bash

echo "🚀 Deploying TaskFlow Client to Vercel..."

# Clean npm cache
echo "Cleaning npm cache..."
npm cache clean --force

# Build the project
echo "Building the project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed successfully!"

# Try to deploy using different methods
echo "Attempting to deploy..."

# Method 1: Try with yarn if available
if command -v yarn &> /dev/null; then
    echo "Trying with yarn..."
    yarn global add vercel
    vercel --prod
elif command -v pnpm &> /dev/null; then
    echo "Trying with pnpm..."
    pnpm add -g vercel
    vercel --prod
else
    echo "Trying with npm..."
    # Try to install vercel globally with force
    npm install -g vercel --force
    if [ $? -eq 0 ]; then
        vercel --prod
    else
        echo "❌ Failed to install Vercel CLI"
        echo "Please try one of the following:"
        echo "1. Install Vercel CLI manually: npm install -g vercel"
        echo "2. Use the Vercel web interface to deploy"
        echo "3. Use the Vercel GitHub integration"
        exit 1
    fi
fi

echo "🎉 Deployment completed!" 