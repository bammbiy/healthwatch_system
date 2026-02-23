# Backend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Install development dependencies for TypeScript compilation
RUN npm install -D typescript @types/node ts-node

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S healthwatch -u 1001

# Build TypeScript
RUN npm run build

# Change ownership of the app directory
RUN chown -R healthwatch:nodejs /app

# Switch to non-root user
USER healthwatch

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start command
CMD ["npm", "start"]