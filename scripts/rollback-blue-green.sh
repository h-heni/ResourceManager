#!/bin/bash
# ============================================
# Blue-Green Rollback Script
# ============================================
# This script performs an immediate rollback to the previous environment.
# Use this when the new deployment has issues and you need to revert quickly.
#
# Usage:
#   ./scripts/rollback-blue-green.sh
#
# What it does:
# 1. Detects the current active environment
# 2. Starts the previous environment (if stopped)
# 3. Runs health checks
# 4. Switches Nginx traffic back
# 5. Stops the failed environment
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
HEALTH_CHECK_INTERVAL=3

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

log_warn "=========================================="
log_warn "INITIATING ROLLBACK"
log_warn "=========================================="

# Check if running in project directory
if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "docker-compose.blue-green.yml not found!"
    log_error "Please run this script from the project root or set PROJECT_DIR."
    exit 3
fi

if [ ! -f "$ENV_FILE" ]; then
    log_error ".env file not found!"
    exit 3
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed!"
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
    CURRENT_ENV=$(grep "^ACTIVE_ENV=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
else
    log_error "ACTIVE_ENV not found in .env!"
    log_error "Cannot determine which environment to rollback from"
    exit 3
fi

log_warn "Current (failed) environment: $CURRENT_ENV"

# Determine rollback target
if [ "$CURRENT_ENV" = "blue" ]; then
    ROLLBACK_ENV="green"
    ROLLBACK_API_PORT=7176
    ROLLBACK_WEB_PORT=8081
else
    ROLLBACK_ENV="blue"
    ROLLBACK_API_PORT=7175
    ROLLBACK_WEB_PORT=8080
fi

log_info "Rolling back to: $ROLLBACK_ENV"

# ============================================
# Confirmation
# ============================================

echo ""
read -p "Are you sure you want to rollback from $CURRENT_ENV to $ROLLBACK_ENV? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Rollback cancelled by user"
    exit 0
fi

# ============================================
# Start Rollback Environment
# ============================================

log_info "Starting $ROLLBACK_ENV environment..."

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" start ${ROLLBACK_ENV}-api ${ROLLBACK_ENV}-web; then
    log_warn "Failed to start containers with 'start', trying 'up -d'..."
    if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d ${ROLLBACK_ENV}-api ${ROLLBACK_ENV}-web; then
        log_error "Failed to start $ROLLBACK_ENV environment"
        exit 2
    fi
fi

log_success "$ROLLBACK_ENV environment started"

# ============================================
# Health Checks
# ============================================

log_info "Running health checks on $ROLLBACK_ENV environment..."

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
if ! check_health "http://localhost:$ROLLBACK_API_PORT/health" "$ROLLBACK_ENV API"; then
    log_error "API health check failed!"
    log_error "Cannot rollback to unhealthy environment"
    log_error "Manual intervention required!"
    exit 1
fi

# Check Web health
if ! check_health "http://localhost:$ROLLBACK_WEB_PORT/health" "$ROLLBACK_ENV Web"; then
    log_error "Web health check failed!"
    log_error "Cannot rollback to unhealthy environment"
    log_error "Manual intervention required!"
    exit 1
fi

log_success "All health checks passed!"

# ============================================
# Switch Nginx Traffic Back
# ============================================

log_info "Switching Nginx traffic back to $ROLLBACK_ENV..."

# Update ACTIVE_ENV in .env
if grep -q "^ACTIVE_ENV=" "$ENV_FILE"; then
    sed -i.bak "s/^ACTIVE_ENV=.*/ACTIVE_ENV=$ROLLBACK_ENV/" "$ENV_FILE"
else
    echo "ACTIVE_ENV=$ROLLBACK_ENV" >> "$ENV_FILE"
fi

# Reload Nginx configuration
if ! docker exec nginx nginx -s reload; then
    log_error "Failed to reload Nginx configuration"
    log_error "Attempting to restart Nginx container..."
    
    if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" restart nginx; then
        log_error "Failed to restart Nginx!"
        log_error "Manual intervention required!"
        exit 2
    fi
fi

log_success "Traffic switched back to $ROLLBACK_ENV environment!"

# ============================================
# Verify Rollback
# ============================================

log_info "Verifying rollback..."

sleep 5

if curl -f -s "http://localhost/health" | grep -q "healthy"; then
    log_success "Rollback verified - application is responding"
else
    log_error "Application not responding after rollback!"
    log_error "Please check container logs"
fi

# ============================================
# Stop Failed Environment
# ============================================

log_info "Stopping failed $CURRENT_ENV environment..."

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" stop ${CURRENT_ENV}-api ${CURRENT_ENV}-web; then
    log_warn "Failed to stop $CURRENT_ENV environment"
    log_warn "You may need to stop it manually"
else
    log_success "$CURRENT_ENV environment stopped"
fi

# ============================================
# Summary
# ============================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Rollback completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Failed environment:   $CURRENT_ENV (stopped)"
echo "  Current environment:  $ROLLBACK_ENV (active)"
echo ""
echo "  Application URL: http://localhost"
echo "  API Health:      http://localhost/api/health"
echo ""
log_info "Next steps:"
echo "  1. Investigate why $CURRENT_ENV deployment failed"
echo "  2. Check logs: docker-compose -f $COMPOSE_FILE logs ${CURRENT_ENV}-api"
echo "  3. Fix issues before next deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0