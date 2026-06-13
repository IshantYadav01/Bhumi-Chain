#!/bin/bash
# =============================================================================
# stop.sh — Stop all Fabric + backend + frontend containers.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/../network"
COMPOSE_PROJECT_NAME=fabric docker compose down -v --remove-orphans
echo "All containers stopped."
