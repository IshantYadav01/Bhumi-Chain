#!/bin/bash
#
# Environment configuration for the Hyperledger Fabric network.
# Edit NUM_ORGS and NUM_PEERS_PER_ORG to scale your full nodes.
#

export PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NETWORK_DIR="${PROJECT_ROOT}/network"
export CHAINCODE_DIR="${PROJECT_ROOT}/chaincode"
export APP_DIR="${PROJECT_ROOT}/application"

# ── Network topology ──────────────────────────────────────────────
export NUM_ORGS=2                    # Number of full-node organisations
export NUM_PEERS_PER_ORG=1           # Peers per organisation (full nodes)
export NUM_ORDERERS=1                # Orderer nodes (use 3 or 5 in production)

# ── Channel & chaincode ───────────────────────────────────────────
export CHANNEL_NAME="mychannel"
export CHAINCODE_NAME="basic"
export CHAINCODE_VERSION="1.0"
export CHAINCODE_SEQUENCE=1

# ── Fabric version pins ───────────────────────────────────────────
export FABRIC_VERSION="2.5"
export CA_VERSION="1.5"

# ── Crypto paths (relative to network/) ───────────────────────────
export CRYPTO_DIR="${NETWORK_DIR}/organizations"

# ── Helper ────────────────────────────────────────────────────────
# Generate ORG list e.g. "org1 org2 org3"
export ORG_LIST=$(for i in $(seq 1 $NUM_ORGS); do echo -n "org${i} "; done)
