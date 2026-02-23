
# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S healthwatch -u 1001

# Change ownership of nginx directories
RUN chown -R healthwatch:nodejs /var/cache/nginx && \
    chown -R healthwatch:nodejs /var/log/nginx && \
    chown -R healthwatch:nodejs /etc/nginx/conf.d

# Create PID directory and change ownership
RUN mkdir -p /var/run/nginx && \
    chown -R healthwatch:nodejs /var/run/nginx

# Switch to non-root user
USER healthwatch

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]