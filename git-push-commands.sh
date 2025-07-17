#!/bin/bash

# GitHub Push Commands with Personal Access Token
# Run these commands to push your code to GitHub

echo "🚀 GitHub Push Commands"
echo "======================="

# Set your GitHub credentials
git config --global user.name "ThanushBD"
git config --global user.email "thanushdinesh04@gmail.com"

# Remove any existing credentials
rm -f ~/.git-credentials
git config --global --unset credential.helper 2>/dev/null || true

# Set the remote URL with the personal access token
# Note: Replace YOUR_GITHUB_TOKEN with your actual personal access token
git remote set-url origin https://ThanushBD:YOUR_GITHUB_TOKEN@github.com/ThanushBD/task.git

# Check git status
echo "Checking git status..."
git status

# Add all files
echo "Adding all files..."
git add .

# Create a commit if there are changes
if ! git diff --cached --quiet; then
    echo "Creating commit..."
    git commit -m "Update TaskFlow with advanced features

    - Added advanced analytics dashboard with real-time charts
    - Implemented email notification system with HTML templates
    - Added WebSocket for real-time updates
    - Implemented file upload system with security validation
    - Added advanced security features (rate limiting, audit logs)
    - Enhanced task assignment tracking with history
    - Added 5-level priority system
    - Implemented scheduled email reminders
    - Enhanced UI/UX with glassmorphism design
    - Added comprehensive error handling and logging
    
    🚀 Generated with Claude Code
    
    Co-Authored-By: Claude <noreply@anthropic.com>"
else
    echo "No changes to commit"
fi

# Push to GitHub
echo "Pushing to GitHub..."
git push origin main

echo "✅ Done! Check your GitHub repository at: https://github.com/ThanushBD/task"