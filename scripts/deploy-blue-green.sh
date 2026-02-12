#!/bin/bash
# ============================================
# Blue-Green Deployment Script
# ============================================
# This script performs zero-downtime deployment by:
# 1. Detecting the current active environment (Blue or Green)
# 2. Deploying to the inactive environment
# 3. Running health checks
# 4. Switching Nginx traffic to the new environment
# 5. Stopping the old environment after verification
#
# Usage:
#   ./scripts/deploy-blue-green.sh
#
# Environment Variables (from .env):
#   ACTIVE_ENV - Current active environment (blue or green)
#   API_IMAGE - Docker image for API
#   WEB_IMAGE - Docker image for Web
#
# Exit Codes:
#   0 - Success
#   1 - Health check failed
#   2 - Docker operation failed
#   3 - Configuration error
# ============================================

set -e  # Exit on any error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.blue-green.yml"
ENV_FILE="$PROJECT_DIR/.env"

# Health check configuration
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=5
MONITORING_DURATION=300  # 5 minutes

# ============================================
# Utility Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================
# Pre-flight Checks
# ============================================

log_info "Starting Blue-Green deployment..."

# Check if running in project directory
if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "docker-compose.blue-green.yml not found!"
    log_error "Please run this script from the project root or set PROJECT_DIR."
    exit 3
fi

if [ ! -f "$ENV_FILE" ]; then
    log_error ".env file not found!"
    log_error "Please create .env from .env.example"
    exit 3
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed!"
    exit 3
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed!"
    exit 3
fi

# Use docker compose or docker-compose
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
fi

# ============================================
# Detect Current Active Environment
# ============================================

cd "$PROJECT_DIR"

# Read ACTIVE_ENV from .env
if grep -q "^ACTIVE_ENV=" "$ENV_FILE"; then
    ACTIVE_ENV=$(grep "^ACTIVE_ENV=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
else
    log_warn "ACTIVE_ENV not found in .env, defaulting to 'blue'"
    ACTIVE_ENV="blue"
fi

log_info "Current active environment: $ACTIVE_ENV"

# Determine target environment
if [ "$ACTIVE_ENV" = "blue" ]; then
    TARGET_ENV="green"
    TARGET_API_PORT=7176
    TARGET_WEB_PORT=8081
else
    TARGET_ENV="blue"
    TARGET_API_PORT=7175
    TARGET_WEB_PORT=8080
fi

log_info "Target deployment environment: $TARGET_ENV"

# ============================================
# Pull Latest Images
# ============================================

log_info "Pulling latest Docker images..."

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" pull ${TARGET_ENV}-api ${TARGET_ENV}-web; then
    log_error "Failed to pull Docker images"
    exit 2
fi

log_success "Images pulled successfully"

# ============================================
# Deploy to Target Environment
# ============================================

log_info "Starting $TARGET_ENV environment..."

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d ${TARGET_ENV}-api ${TARGET_ENV}-web; then
    log_error "Failed to start $TARGET_ENV environment"
    exit 2
fi

log_success "$TARGET_ENV environment started"

# ============================================
# Health Checks
# ============================================

log_info "Running health checks on $TARGET_ENV environment..."

# Function to check health endpoint
check_health() {
    local url=$1
    local name=$2
    
    log_info "Checking $name health..."
    
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        if curl -f -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
            log_success "$name is healthy"
            return 0
        fi
        
        log_warn "Health check attempt $i/$HEALTH_CHECK_RETRIES failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "$name health check failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Check API health
if ! check_health "http://localhost:$TARGET_API_PORT/health" "$TARGET_ENV API"; then
    log_error "API health check failed. Rolling back..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" stop ${TARGET_ENV}-api ${TARGET_ENV}-web
    exit 1
fi

# Check Web health
if ! check_health "http://localhost:$TARGET_WEB_PORT/health" "$TARGET_ENV Web"; then
    log_error "Web health check failed. Rolling back..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" stop ${TARGET_ENV}-api ${TARGET_ENV}-web
    exit 1
fi

log_success "All health checks passed!"

# ============================================
# Additional Verification
# ============================================

log_info "Running additional verification..."

# Check container status
if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps | grep -q "${TARGET_ENV}-api.*Up"; then
    log_error "$TARGET_ENV API container is not running"
    exit 2
fi

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps | grep -q "${TARGET_ENV}-web.*Up"; then
    log_error "$TARGET_ENV Web container is not running"
    exit 2
fi

log_success "Container verification passed"

# ============================================
# Switch Nginx Traffic
# ============================================

log_info "Switching Nginx traffic to $TARGET_ENV..."

# Update ACTIVE_ENV in .env
if grep -q "^ACTIVE_ENV=" "$ENV_FILE"; then
    sed -i.bak "s/^ACTIVE_ENV=.*/ACTIVE_ENV=$TARGET_ENV/" "$ENV_FILE"
else
    echo "ACTIVE_ENV=$TARGET_ENV" >> "$ENV_FILE"
fi

# Reload Nginx configuration
if ! docker exec nginx nginx -s reload; then
    log_error "Failed to reload Nginx configuration"
    log_error "Manual intervention required!"
    exit 2
fi

log_success "Traffic switched to $TARGET_ENV environment!"
log_info "Nginx is now routing traffic to $TARGET_ENV"

# ============================================
# Monitoring Period
# ============================================

log_info "Monitoring $TARGET_ENV environment for $MONITORING_DURATION seconds..."
log_info "Press Ctrl+C to cancel and keep both environments running"

# Monitor for specified duration
for i in $(seq 1 $((MONITORING_DURATION / 10))); do
    sleep 10
    
    # Check if new environment is still healthy
    if ! curl -f -s -o /dev/null "http://localhost:$TARGET_API_PORT/health"; then
        log_error "$TARGET_ENV environment became unhealthy!"
        log_error "Please investigate and run rollback script if needed"
        exit 1
    fi
    
    if [ $((i % 6)) -eq 0 ]; then
        log_info "Monitoring... $((i * 10))s elapsed (${TARGET_ENV} is healthy)"
    fi
done

log_success "Monitoring complete. $TARGET_ENV is stable."

# ============================================
# Stop Old Environment
# ============================================

log_info "Stopping old $ACTIVE_ENV environment..."

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" stop ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web; then
    log_warn "Failed to stop $ACTIVE_ENV environment, but deployment was successful"
    log_warn "You may need to stop it manually"
else
    log_success "$ACTIVE_ENV environment stopped"
fi

# ============================================
# Cleanup
# ============================================

log_info "Cleaning up old Docker images..."
docker image prune -f > /dev/null 2>&1 || true

# ============================================
# Summary
# ============================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Deployment completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Previous environment: $ACTIVE_ENV (stopped)"
echo "  Current environment:  $TARGET_ENV (active)"
echo ""
echo "  Application URL: http://localhost"
echo "  API Health:      http://localhost/api/health"
echo "  Swagger:         http://localhost/swagger"
echo ""
echo "  Direct access:"
echo "    API:  http://localhost:$TARGET_API_PORT"
echo "    Web:  http://localhost:$TARGET_WEB_PORT"
echo ""
log_info "To rollback: ./scripts/rollback-blue-green.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
