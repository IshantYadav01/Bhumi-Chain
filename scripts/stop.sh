#!/bin/bash
# =============================================================================
# stop.sh — Kill port processes + docker compose down
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# Kill any processes holding ports 8080 and 3000
for port in 8080 3000; do
    fuser -k ${port}/tcp 2>/dev/null || true
done

docker compose down -v --remove-orphans
echo "All containers stopped."
