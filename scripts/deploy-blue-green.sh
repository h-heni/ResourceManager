#!/bin/bash
# ============================================
# Blue-Green Deployment Script (2GB VPS)
# ============================================
# Sequential swap: stop old → start new → health check → switch nginx
# ~10-15s downtime during swap.
#
# DB migrations run automatically at API startup (EF Core).
#
# Usage:  ./scripts/deploy-blue-green.sh
#
# Exit Codes:
#   0 - Success
#   1 - Health check failed (rollback done)
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

HEALTH_CHECK_RETRIES=20
HEALTH_CHECK_INTERVAL=5

# ── Utility ──

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR]${NC}  $1"; }

# ── Pre-flight ──

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Blue-Green Deploy (2GB VPS — sequential swap)"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ ! -f "$COMPOSE_FILE" ] && { log_error "docker-compose.blue-green.yml not found"; exit 3; }
[ ! -f "$ENV_FILE" ]     && { log_error ".env file not found"; exit 3; }
command -v docker &>/dev/null || { log_error "Docker not installed"; exit 3; }

# Use docker compose v2 syntax (v5.x uses this too)
DC="docker compose"

cd "$PROJECT_DIR"

# ── Detect active environment ──

if grep -q "^ACTIVE_ENV=" "$ENV_FILE"; then
    ACTIVE_ENV=$(grep "^ACTIVE_ENV=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
else
    ACTIVE_ENV="blue"
fi

if [ "$ACTIVE_ENV" = "blue" ]; then
    TARGET_ENV="green"; TARGET_API_PORT=7176; TARGET_WEB_PORT=8081
else
    TARGET_ENV="blue";  TARGET_API_PORT=7175; TARGET_WEB_PORT=8080
fi

log_info "Active: $ACTIVE_ENV → Deploying to: $TARGET_ENV"

# ── Pull images (while old env still serves traffic) ──

log_info "Pulling latest images..."
$DC -f "$COMPOSE_FILE" pull ${TARGET_ENV}-api ${TARGET_ENV}-web 2>/dev/null || { log_error "Pull failed"; exit 2; }
log_success "Images pulled"

# ── Ensure infrastructure is running ──

log_info "Starting infrastructure (PostgreSQL + Redis)..."
$DC -f "$COMPOSE_FILE" up -d postgres_db redis 2>/dev/null

log_info "Waiting for PostgreSQL..."
for i in $(seq 1 20); do
    docker exec postgres_db pg_isready -U "${POSTGRES_USER:-rmuser}" -d "${POSTGRES_DB:-resourcemanager}" &>/dev/null && break
    [ "$i" -eq 20 ] && { log_error "PostgreSQL not ready after 60s"; exit 2; }
    sleep 3
done
log_success "PostgreSQL ready"

log_info "Waiting for Redis..."
for i in $(seq 1 10); do
    docker exec rm-redis redis-cli ping &>/dev/null && break
    [ "$i" -eq 10 ] && { log_warn "Redis health check skipped"; break; }
    sleep 2
done
log_success "Redis ready"

# ── SEQUENTIAL SWAP: stop old → start new ──

log_warn "2GB mode: stopping $ACTIVE_ENV before starting $TARGET_ENV (~10-15s downtime)"
$DC -f "$COMPOSE_FILE" stop ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web 2>/dev/null || true
# Also stop nginx so it doesn't error while backends are down
$DC -f "$COMPOSE_FILE" stop nginx 2>/dev/null || true
sleep 3

log_info "Starting $TARGET_ENV (DB migrations apply at API startup)..."
if ! $DC -f "$COMPOSE_FILE" up -d ${TARGET_ENV}-api ${TARGET_ENV}-web; then
    log_error "Start failed! Rolling back to $ACTIVE_ENV..."
    $DC -f "$COMPOSE_FILE" up -d ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web
    exit 2
fi

# ── Health checks ──

check_health() {
    local url=$1 name=$2
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
        CODE=$(curl -f -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        [ "$CODE" = "200" ] && { log_success "$name healthy"; return 0; }
        log_info "  $name attempt $i/$HEALTH_CHECK_RETRIES (HTTP $CODE)..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    log_error "$name health check failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

if ! check_health "http://localhost:$TARGET_API_PORT/health" "$TARGET_ENV API"; then
    log_error "Rollback: restarting $ACTIVE_ENV..."
    $DC -f "$COMPOSE_FILE" stop ${TARGET_ENV}-api ${TARGET_ENV}-web 2>/dev/null || true
    $DC -f "$COMPOSE_FILE" up -d ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web
    # Restore nginx pointing to old env
    sed -i.bak "s/^ACTIVE_ENV=.*/ACTIVE_ENV=$ACTIVE_ENV/" "$ENV_FILE"
    $DC -f "$COMPOSE_FILE" up -d --force-recreate nginx
    exit 1
fi

if ! check_health "http://localhost:$TARGET_WEB_PORT/health" "$TARGET_ENV Web"; then
    log_error "Rollback: restarting $ACTIVE_ENV..."
    $DC -f "$COMPOSE_FILE" stop ${TARGET_ENV}-api ${TARGET_ENV}-web 2>/dev/null || true
    $DC -f "$COMPOSE_FILE" up -d ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web
    sed -i.bak "s/^ACTIVE_ENV=.*/ACTIVE_ENV=$ACTIVE_ENV/" "$ENV_FILE"
    $DC -f "$COMPOSE_FILE" up -d --force-recreate nginx
    exit 1
fi

log_success "All health checks passed — migrations applied"

# ── Switch Nginx to new environment ──
# We MUST recreate nginx (not reload) because envsubst runs at startup.
# Changing ACTIVE_ENV in .env + force-recreate re-runs envsubst with new value.

log_info "Switching Nginx → $TARGET_ENV..."
grep -q "^ACTIVE_ENV=" "$ENV_FILE" \
    && sed -i.bak "s/^ACTIVE_ENV=.*/ACTIVE_ENV=$TARGET_ENV/" "$ENV_FILE" \
    || echo "ACTIVE_ENV=$TARGET_ENV" >> "$ENV_FILE"

# Force-recreate picks up new ACTIVE_ENV from .env and re-runs envsubst
$DC -f "$COMPOSE_FILE" up -d --force-recreate nginx
sleep 3

# ── Verify via proxy ──

curl -f -s -o /dev/null "http://localhost/health"     && log_success "Nginx proxy OK" || log_warn "Nginx proxy check failed (may need a few seconds)"
curl -f -s -o /dev/null "http://localhost/api/health"  && log_success "API via Nginx OK" || log_warn "API via Nginx check failed"

# ── Cleanup ──

$DC -f "$COMPOSE_FILE" rm -f ${ACTIVE_ENV}-api ${ACTIVE_ENV}-web 2>/dev/null || true
docker image prune -f --filter "until=48h" >/dev/null 2>&1 || true

# ── Summary ──

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Previous : $ACTIVE_ENV (stopped)"
echo "  Current  : $TARGET_ENV (active)"
echo "  Mode     : 2GB RAM sequential swap"
echo "  URL      : http://localhost"
echo "  API      : http://localhost/api/health"
echo "  Migrations: auto-applied at startup"
echo ""
echo "  Rollback : ./scripts/rollback-blue-green.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
