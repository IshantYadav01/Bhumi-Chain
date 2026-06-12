#!/bin/bash
# =============================================================================
# start.sh — Launch the Hyperledger Fabric network.
#
# This brings up all full nodes (orderer + 5 department peers) plus the admin CLI.
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
echo "▶ Starting full nodes (orderer + 5 department peers)..."
COMPOSE_PROJECT_NAME=fabric docker compose up -d

echo ""
echo "▶ Waiting for peers to be ready..."
sleep 5

# ── Create & join channel ────────────────────────────────────────────
echo ""
echo "▶ Creating channel 'mychannel'..."

ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

# Create channel from Municipality peer (the CLI is configured for Municipality by default)
docker exec cli bash -c "
    export ORDERER_CA=${ORDERER_CA}
    peer channel create \
        -o orderer.example.com:7050 \
        -c mychannel \
        --ordererTLSHostnameOverride orderer.example.com \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
        --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block \
        --tls --cafile \$ORDERER_CA
" 2>&1 | grep -v "^$" || echo "  ⚠ Channel may already exist"

echo "  ✔ Channel created"

# ── Join all 5 peers ─────────────────────────────────────────────────

# 1. Municipality (port 7051) — CLI defaults to this peer, no extra env needed
echo ""
echo "▶ Joining Municipality peer to channel..."
docker exec cli bash -c "
    peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block
" 2>&1 | grep -v "^$"
echo "  ✔ Municipality peer joined"

# 2. Malpot (port 8051)
echo ""
echo "▶ Joining Malpot peer to channel..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/malpot.example.com/users/Admin@malpot.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.malpot.example.com:8051 \
    -e CORE_PEER_LOCALMSPID=MalpotMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/malpot.example.com/peers/peer0.malpot.example.com/tls/ca.crt \
    cli bash -c "
    peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block
" 2>&1 | grep -v "^$"
echo "  ✔ Malpot peer joined"

# 3. Survey (port 9051)
echo ""
echo "▶ Joining Survey peer to channel..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/survey.example.com/users/Admin@survey.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.survey.example.com:9051 \
    -e CORE_PEER_LOCALMSPID=SurveyMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/survey.example.com/peers/peer0.survey.example.com/tls/ca.crt \
    cli bash -c "
    peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block
" 2>&1 | grep -v "^$"
echo "  ✔ Survey peer joined"

# 4. LandRegistry (port 10051)
echo ""
echo "▶ Joining LandRegistry peer to channel..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/landregistry.example.com/users/Admin@landregistry.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.landregistry.example.com:10051 \
    -e CORE_PEER_LOCALMSPID=LandRegistryMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/landregistry.example.com/peers/peer0.landregistry.example.com/tls/ca.crt \
    cli bash -c "
    peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block
" 2>&1 | grep -v "^$"
echo "  ✔ LandRegistry peer joined"

# 5. Finance (port 11051)
echo ""
echo "▶ Joining Finance peer to channel..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/finance.example.com/users/Admin@finance.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.finance.example.com:11051 \
    -e CORE_PEER_LOCALMSPID=FinanceMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/finance.example.com/peers/peer0.finance.example.com/tls/ca.crt \
    cli bash -c "
    peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block
" 2>&1 | grep -v "^$"
echo "  ✔ Finance peer joined"

# ── Update anchor peers for all 5 orgs ──────────────────────────────
echo ""
echo "▶ Updating anchor peers..."

update_anchor() {
    local ORG_DOMAIN="$1"       # e.g. municipality
    local MSP_ID="$2"           # e.g. MunicipalityMSP
    local PEER_PORT="$3"        # e.g. 7051
    local ANCHOR_FILE="$4"      # e.g. municipalityMSPanchors.tx

    local MSP_PATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${ORG_DOMAIN}.example.com/users/Admin@${ORG_DOMAIN}.example.com/msp"
    local TLS_CERT="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${ORG_DOMAIN}.example.com/peers/peer0.${ORG_DOMAIN}.example.com/tls/ca.crt"
    local PEER_ADDR="peer0.${ORG_DOMAIN}.example.com:${PEER_PORT}"

    docker exec \
        -e CORE_PEER_MSPCONFIGPATH="${MSP_PATH}" \
        -e CORE_PEER_ADDRESS="${PEER_ADDR}" \
        -e CORE_PEER_LOCALMSPID="${MSP_ID}" \
        -e CORE_PEER_TLS_ROOTCERT_FILE="${TLS_CERT}" \
        cli bash -c "
            export ORDERER_CA=${ORDERER_CA}
            peer channel update \
                -o orderer.example.com:7050 \
                -c mychannel \
                --ordererTLSHostnameOverride orderer.example.com \
                -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${ANCHOR_FILE} \
                --tls --cafile \$ORDERER_CA
        " 2>&1 | grep -v "^$"
    echo "  ✔ ${MSP_ID} anchor peers updated"
}

update_anchor "municipality"  "MunicipalityMSP"  "7051"  "municipalityMSPanchors.tx"
update_anchor "malpot"        "MalpotMSP"        "8051"  "malpotMSPanchors.tx"
update_anchor "survey"        "SurveyMSP"        "9051"  "surveyMSPanchors.tx"
update_anchor "landregistry"  "LandRegistryMSP"  "10051" "landregistryMSPanchors.tx"
update_anchor "finance"       "FinanceMSP"       "11051" "financeMSPanchors.tx"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Network is LIVE                         ║"
echo "║                                           ║"
echo "║   Full nodes running:                     ║"
echo "║     - orderer.example.com:7050            ║"
echo "║     - peer0.municipality.example.com:7051 ║"
echo "║     - peer0.malpot.example.com:8051       ║"
echo "║     - peer0.survey.example.com:9051       ║"
echo "║     - peer0.landregistry.example.com:10051║"
echo "║     - peer0.finance.example.com:11051     ║"
echo "║                                           ║"
echo "║   Next: deploy chaincode & start lite     ║"
echo "║         nodes via application/            ║"
echo "╚══════════════════════════════════════════╝"
