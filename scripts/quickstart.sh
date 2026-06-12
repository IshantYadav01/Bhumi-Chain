#!/bin/bash
# =============================================================================
# quickstart.sh — Fast reload of Fabric network + Go backend + frontend.
# Does NOT tear down or rebuild — just starts what's stopped.
# Use after the initial: ./scripts/rebuild.sh
# =============================================================================
set -euo pipefail
PROJ="$(cd "$(dirname "$0")/.." && pwd)"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
info(){ echo -e "${CYAN}[*]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

echo "╔══════════════════════════════════════╗"
echo "║   Land Registry — Quick Start        ║"
echo "╚══════════════════════════════════════╝"

# ── 1. Docker network ───────────────────────────────────────────────
info "Checking Fabric network..."
cd "$PROJ/network"

RUNNING=$(docker ps --format '{{.Names}}' | grep -c 'peer0.province\|orderer.example' 2>/dev/null || echo 0)
if [ "$RUNNING" -ge 4 ]; then
    ok "Network already running ($RUNNING containers)"
else
    info "Starting network..."
    COMPOSE_PROJECT_NAME=fabric docker compose up -d 2>&1
    sleep 5
    ok "Network started"
fi

# ── 2. Permissions (Docker gen'd files may be root-owned) ───────────
if [ ! -r "$PROJ/network/organizations/peerOrganizations/province1.example.com/users/User1@province1.example.com/msp/keystore/priv_sk" ]; then
    info "MSP files are root-owned — fixing (sudo may prompt)..."
    sudo chown -R "$(whoami)" "$PROJ/network/organizations"
    ok "Permissions fixed"
fi

# ── 3. Go backend ───────────────────────────────────────────────────
info "Building Go backend..."
cd "$PROJ/backend"

# Kill old instance
kill $(lsof -ti:8080) 2>/dev/null || true
sleep 1

go build -o server . 2>&1
ok "Built"

PROJECT_ROOT="$PROJ" nohup ./server > backend.log 2>&1 &
sleep 2

if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    ok "Backend running on :8080"
else
    err "Backend failed to start — check backend/backend.log"
    tail -20 "$PROJ/backend/backend.log"
    exit 1
fi

# ── 4. Frontend (optional) ──────────────────────────────────────────
if [ "${1:-}" = "--frontend" ] || [ "${1:-}" = "-f" ]; then
    info "Starting Next.js frontend..."
    cd "$PROJ/frontend"

    # Kill old dev server
    kill $(lsof -ti:3000) 2>/dev/null || true

    if [ ! -d node_modules ]; then
        npm install --silent 2>&1
    fi

    npm run dev > /dev/null 2>&1 &
    sleep 3

    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        ok "Frontend running on :3000"
    else
        err "Frontend may still be starting"
    fi
fi

# ── Done ────────────────────────────────────────────────────────────
echo ""
ok "======================================="
ok "  Land Registry is LIVE!"
ok "  Backend  : http://localhost:8080"
ok "  Health   : http://localhost:8080/health"
if [ "${1:-}" = "--frontend" ] || [ "${1:-}" = "-f" ]; then
    ok "  Frontend : http://localhost:3000"
else
    info "  Frontend : cd frontend && npm run dev"
fi
ok "======================================="
