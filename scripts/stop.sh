#!/bin/bash
# =============================================================================
# stop.sh — docker compose down
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down -v --remove-orphans
echo "All containers stopped."
