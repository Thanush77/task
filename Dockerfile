# TaskFlow Analytics - Production Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install system dependencies for canvas and other native modules
RUN apk add --no-cache \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/ 2>/dev/null || :

# Install dependencies
RUN npm install --production
RUN cd server && npm install --production
RUN if [ -f client/package.json ]; then cd client && npm install --production; fi

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads
RUN chmod 755 uploads

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S taskflow -u 1001
RUN chown -R taskflow:nodejs /usr/src/app

USER taskflow

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node server/healthcheck.js || exit 1

# Start application
CMD ["node", "server/server.js"]