#!/bin/bash
# =============================================================================
# quickstart.sh — Fast start of the containerized land registry.
# No rebuild — just brings up containers if stopped.
# =============================================================================
set -euo pipefail
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJ/network"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
info(){ echo -e "${CYAN}[*]${NC} $1"; }

echo "Land Registry — Quick Start"

# Start if not running
RUNNING=$(docker ps --format '{{.Names}}' | grep -c 'peer0.province\|orderer.example' 2>/dev/null || echo 0)
if [ "$RUNNING" -ge 4 ]; then
    ok "Containers already running"
else
    info "Starting containers..."
    COMPOSE_PROJECT_NAME=fabric docker compose up -d --build 2>&1
    ok "Containers started"
fi

ok "Backend  : http://localhost:8080/health"
ok "Frontend : http://localhost:3000"
