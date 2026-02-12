# ============================================
# ResourceManager - Nginx Reverse Proxy Dockerfile
# ============================================
# This builds a lightweight nginx reverse proxy container
# that routes traffic to the frontend and backend services.
# ============================================

FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/nginx.conf

# Copy our custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directory for custom error pages
RUN mkdir -p /usr/share/nginx/html

# Create a simple error page
RUN echo '<!DOCTYPE html><html><head><title>Service Unavailable</title></head><body><h1>503 Service Unavailable</h1><p>The server is temporarily unable to service your request. Please try again later.</p></body></html>' > /usr/share/nginx/html/50x.html

# Create non-root user for security
RUN adduser -D -u 1001 nginxuser && \
    chown -R nginxuser:nginxuser /var/cache/nginx && \
    chown -R nginxuser:nginxuser /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginxuser:nginxuser /var/run/nginx.pid

# Note: We still run as root user because nginx master process needs to bind to port 80
# The worker processes will run as 'nginx' user as specified in nginx.conf

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
