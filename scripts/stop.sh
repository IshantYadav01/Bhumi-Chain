#!/bin/bash
# =============================================================================
# stop.sh — Tear down the Hyperledger Fabric network and Go backend.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ_DIR="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$PROJ_DIR/network"

# Stop Go backend
pkill -f 'backend/server' 2>/dev/null && echo "✔ Go backend stopped." || true

cd "$NETWORK_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║   Stopping Hyperledger Fabric Network    ║"
echo "╚══════════════════════════════════════════╝"

COMPOSE_PROJECT_NAME=fabric docker compose down -v --remove-orphans

echo ""
echo "✔ Network stopped. All containers & volumes removed."

# Optional: clean up chaincode container images
if [ "${1:-}" = "--clean" ]; then
    echo ""
    echo "▶ Removing landreg chaincode Docker images..."
    docker rmi -f $(docker images -q --filter "reference=dev-peer*landreg*") 2>/dev/null || true
    echo "✔ landreg chaincode images removed."
fi
