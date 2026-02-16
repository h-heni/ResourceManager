# ============================================
# ResourceManager Frontend - Multi-stage Dockerfile
# ============================================
# Build: docker build -t resourcemanager-web .
# Run:   docker run -p 80:80 resourcemanager-web
# ============================================

# Stage 1: Build with Node (discarded after build)
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables
# VITE_API_URL is empty — nginx proxies /api to the backend at runtime
ARG VITE_API_URL=""

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
# VITE_GOOGLE_CLIENT_ID removed — Google OAuth temporarily disabled

# Build production bundle
RUN npm run build

# Stage 2: Production with Nginx Alpine (~25MB final image)
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built assets from build stage
COPY --from=build /app/dist .

# Copy nginx config as template (envsubst replaces BACKEND_API_HOST/PORT at startup)
COPY nginx.conf /etc/nginx/default.conf.template

# Create non-root user
RUN adduser -D -u 1001 appuser && \
    chown -R appuser:appuser /usr/share/nginx/html && \
    chown -R appuser:appuser /var/cache/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appuser /var/run/nginx.pid

# Expose port
EXPOSE 80

# Default env vars for API proxy (overridden by docker-compose)
ENV BACKEND_API_HOST=api
ENV BACKEND_API_PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx (envsubst replaces only our custom env vars, leaving nginx $vars intact)
CMD ["sh", "-c", "envsubst '${BACKEND_API_HOST} ${BACKEND_API_PORT}' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
