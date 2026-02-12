#!/bin/bash
# =============================================================================
# Setup Test Environment
# =============================================================================
# This script sets up the environment for load testing

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Setting up Load Testing Environment                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Check Docker
echo "✓ Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    exit 1
fi
echo "  Docker: $(docker --version)"

# 2. Check Docker Compose
echo "✓ Checking Docker Compose..."
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
    exit 1
fi
echo "  Docker Compose: $(docker compose version)"

# 3. Check k6
echo "✓ Checking k6..."
if ! command -v k6 &> /dev/null; then
    echo "⚠️  k6 is not installed!"
    echo ""
    echo "Install k6:"
    echo "  macOS:    brew install k6"
    echo "  Ubuntu:   sudo apt install k6"
    echo "  Docker:   docker pull grafana/k6:latest"
    echo ""
    read -p "Continue without k6? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "  k6: $(k6 version)"
fi

# 4. Check .env file
echo ""
echo "✓ Checking environment configuration..."
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "⚠️  .env file not found!"
    echo "  Creating from .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo "  ⚠️  IMPORTANT: Edit .env and set your passwords and secrets!"
    echo ""
fi

# 5. Start services
echo ""
echo "✓ Starting services..."
cd "$ROOT_DIR"
docker compose down 2>/dev/null || true
docker compose up -d

# 6. Wait for services to be ready
echo ""
echo "✓ Waiting for services to be ready..."
echo "  This may take 30-60 seconds..."

MAX_WAIT=120
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -s -f http://localhost:7175/health > /dev/null 2>&1; then
        echo "  ✅ API is ready!"
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo "  ... waiting ($ELAPSED/$MAX_WAIT seconds)"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "  ❌ API failed to start within $MAX_WAIT seconds"
    echo ""
    echo "Check logs with:"
    echo "  docker compose logs api"
    exit 1
fi

# 7. Check database
echo ""
echo "✓ Checking database..."
if docker compose exec -T postgres_db pg_isready -U rmuser > /dev/null 2>&1; then
    echo "  ✅ Database is ready!"
else
    echo "  ❌ Database is not responding"
    exit 1
fi

# 8. Apply migrations (if needed)
echo ""
echo "✓ Checking database migrations..."
echo "  Note: Migrations should run automatically on API startup"

# 9. Create test data (optional)
echo ""
echo "✓ Test data setup..."
echo "  Using existing test account: AHT@gmail.com / AHT@gmail.com"
echo ""
echo "  If you need more test users, create them via the API:"
echo "    POST http://localhost:7175/api/auth/signup"
echo ""

# 10. Final status check
echo ""
echo "✓ Verifying setup..."
docker compose ps

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Setup Complete!                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Services:"
echo "  API:        http://localhost:7175"
echo "  Database:   localhost:5432 (internal only)"
echo "  Frontend:   http://localhost:80"
echo ""
echo "Next steps:"
echo "  1. Run smoke test:  ./load-testing/run-test.sh smoke"
echo "  2. Review results in load-testing/results/"
echo "  3. Start monitoring: docker compose -f load-testing/docker-compose.monitoring.yml up -d"
echo "  4. View Grafana:     http://localhost:3000 (admin/admin)"
echo ""
