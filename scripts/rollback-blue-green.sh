#!/bin/bash
# ============================================
# Blue-Green Rollback Script (2GB VPS)
# ============================================
# Rolls back to the previous environment.
#
# Usage: ./scripts/rollback-blue-green.sh
#
# Exit Codes:
#   0 - Success
#   1 - Health check failed
#   2 - Docker operation failed
#   3 - Configuration error
# ============================================

set -e
set -u

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.blue-green.yml"
ENV_FILE="$PROJECT_DIR/.env"

HEALTH_CHECK_RETRIES=15
HEALTH_CHECK_INTERVAL=3

# Utility
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR]${NC}  $1"; }

# Pre-flight
echo ""
log_warn "=========================================="
log_warn "INITIATING ROLLBACK"
log_warn "=========================================="

[ ! -f "$COMPOSE_FILE" ] && { log_error "docker-compose.blue-green.yml not found"; exit 3; }
[ ! -f "$ENV_FILE" ]     && { log_error ".env file not found"; exit 3; }

DC="docker compose"
cd "$PROJECT_DIR"

# Detect current active environment
if grep -q "^ACTIVE_ENV=" "$ENV_FILE"; then
    CURRENT_ENV=$(grep "^ACTIVE_ENV=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
else
    log_error "ACTIVE_ENV not found in .env"
    exit 3
fi

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

log_warn "Current (failed): $CURRENT_ENV"
log_info "Rolling back to: $ROLLBACK_ENV"

# Stop current failed environment
log_info "Stopping $CURRENT_ENV..."
$DC -f "$COMPOSE_FILE" stop ${CURRENT_ENV}-api ${CURRENT_ENV}-web 2>/dev/null || true
$DC -f "$COMPOSE_FILE" stop nginx 2>/dev/null || true
sleep 3

# Start rollback environment
log_info "Starting $ROLLBACK_ENV..."
if ! $DC -f "$COMPOSE_FILE" up -d ${ROLLBACK_ENV}-api ${ROLLBACK_ENV}-web; then
    log_error "Failed to start $ROLLBACK_ENV — manual intervention required"
    exit 2
fi

# Health checks
check_health() {
    local url=$1 name=$2
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        CODE=$(curl -f -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        [ "$CODE" = "200" ] && { log_success "$name healthy"; return 0; }
        log_info "  $name attempt $i/$HEALTH_CHECK_RETRIES (HTTP $CODE)..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    log_error "$name health check failed"
    return 1
}

if ! check_health "http://localhost:$ROLLBACK_API_PORT/health" "$ROLLBACK_ENV API"; then
    log_error "Cannot rollback — $ROLLBACK_ENV API unhealthy. Manual intervention required."
    exit 1
fi

if ! check_health "http://localhost:$ROLLBACK_WEB_PORT/health" "$ROLLBACK_ENV Web"; then
    log_error "Cannot rollback — $ROLLBACK_ENV Web unhealthy. Manual intervention required."
    exit 1
fi

# Switch Nginx (force-recreate to re-run envsubst with new ACTIVE_ENV)
log_info "Switching Nginx → $ROLLBACK_ENV..."
grep -q "^ACTIVE_ENV=" "$ENV_FILE" \
    && sed -i.bak "s/^ACTIVE_ENV=.*/ACTIVE_ENV=$ROLLBACK_ENV/" "$ENV_FILE" \
    || echo "ACTIVE_ENV=$ROLLBACK_ENV" >> "$ENV_FILE"

$DC -f "$COMPOSE_FILE" up -d --force-recreate nginx
sleep 3

# Verify
curl -f -s -o /dev/null "http://localhost/health" && log_success "Nginx proxy OK" || log_warn "Nginx proxy check inconclusive"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Rollback complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Failed:   $CURRENT_ENV (stopped)"
echo "  Active:   $ROLLBACK_ENV"
echo "  URL:      http://localhost"
echo "  API:      http://localhost/api/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
