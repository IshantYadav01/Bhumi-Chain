#!/bin/bash
# =============================================================================
# quickstart.sh — docker compose up --build
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d --build
echo "Backend  : http://localhost:8080/health"
echo "Frontend : http://localhost:3000"
