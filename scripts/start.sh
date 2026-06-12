#!/bin/bash
# =============================================================================
# start.sh — Launch the Hyperledger Fabric network.
#
# This brings up all full nodes (orderer + peers) plus the admin CLI.
# Lite nodes are started separately via the application/ directory.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")/network"

cd "$NETWORK_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║   Starting Hyperledger Fabric Network    ║"
echo "╚══════════════════════════════════════════╝"

# Check that artifacts exist
if [ ! -f channel-artifacts/genesis.block ]; then
    echo "✘ Artifacts not found. Run './scripts/generate.sh' first."
    exit 1
fi

# Bring down any stale containers
echo ""
echo "▶ Cleaning up previous containers..."
docker compose down -v --remove-orphans 2>/dev/null || true

# Start the network
echo ""
echo "▶ Starting full nodes (orderer + peers)..."
COMPOSE_PROJECT_NAME=fabric docker compose up -d

echo ""
echo "▶ Waiting for peers to be ready..."
sleep 5

# ── Create & join channel ────────────────────────────────────────────
echo ""
echo "▶ Creating channel 'mychannel'..."

# Create channel from Org1 peer
docker exec cli bash -c '
    export ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
    peer channel create \
        -o orderer.example.com:7050 \
        -c mychannel \
        --ordererTLSHostnameOverride orderer.example.com \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
        --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block \
        --tls --cafile $ORDERER_CA
' 2>&1 | grep -v "^$" || echo "  ⚠ Channel may already exist"

echo "  ✔ Channel created"

# ── Join Org1 peer ──────────────────────────────────────────────────
echo ""
echo "▶ Joining Org1 peer to channel..."
docker exec cli bash -c '
    peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block
' 2>&1 | grep -v "^$"
echo "  ✔ Org1 peer joined"

# ── Join Org2 peer ──────────────────────────────────────────────────
echo ""
echo "▶ Joining Org2 peer to channel..."
docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 \
    -e CORE_PEER_LOCALMSPID=Org2MSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
    cli bash -c '
    peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block
' 2>&1 | grep -v "^$"
echo "  ✔ Org2 peer joined"

# ── Update anchor peers ─────────────────────────────────────────────
echo ""
echo "▶ Updating anchor peers..."
for org in Org1 Org2; do
    MSP="${org}MSP"
    ANCHOR_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${org,,}MSPanchors.tx"
    PEER_ADDR="peer0.${org,,}.example.com:7051"
    if [ "$org" = "Org2" ]; then PEER_ADDR="peer0.org2.example.com:9051"; fi

    docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${org,,}.example.com/users/Admin@${org,,}.example.com/msp \
        -e CORE_PEER_ADDRESS=$PEER_ADDR \
        -e CORE_PEER_LOCALMSPID=$MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${org,,}.example.com/peers/peer0.${org,,}.example.com/tls/ca.crt \
        cli bash -c "
        export ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
        peer channel update \
            -o orderer.example.com:7050 \
            -c mychannel \
            --ordererTLSHostnameOverride orderer.example.com \
            -f $ANCHOR_FILE \
            --tls --cafile \$ORDERER_CA
    " 2>&1 | grep -v "^$"
    echo "  ✔ ${org} anchor peers updated"
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Network is LIVE                         ║"
echo "║                                           ║"
echo "║   Full nodes running:                     ║"
echo "║     - orderer.example.com:7050            ║"
echo "║     - peer0.org1.example.com:7051         ║"
echo "║     - peer0.org2.example.com:9051         ║"
echo "║                                           ║"
echo "║   Next: deploy chaincode & start lite     ║"
echo "║         nodes via application/            ║"
echo "╚══════════════════════════════════════════╝"
