#!/bin/bash
# =============================================================================
# rebuild.sh — Full tear-down + rebuild + deploy + seed.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
PROJ="$(pwd)"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[*]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

# Helper: run a peer CLI command targeting a specific peer index (0, 1, 2)
peer_at() {
    local i=$1; shift
    local peer="peer${i}" msp="LandregMSP"
    local p=$((7051+i*1000))
    local mspdir="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/landreg.com/users/Admin@landreg.com/msp"
    local tls="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/landreg.com/peers/${peer}.landreg.com/tls/ca.crt"
    docker exec -e "CORE_PEER_MSPCONFIGPATH=${mspdir}" -e "CORE_PEER_ADDRESS=${peer}.landreg.com:${p}" \
        -e "CORE_PEER_LOCALMSPID=${msp}" -e "CORE_PEER_TLS_ROOTCERT_FILE=${tls}" cli peer "$@"
}

echo "╔══════════════════════════════════╗"
echo "║  Land Registry — Full Rebuild    ║"
echo "╚══════════════════════════════════╝"

log "Pulling Fabric images..."
docker pull hyperledger/fabric-peer:2.5
docker pull hyperledger/fabric-orderer:2.5
docker pull hyperledger/fabric-tools:2.5
docker pull hyperledger/fabric-ccenv:2.5
ok "Images ready"

log "Installing dependencies..."
cd "$PROJ/backend/chaincode/go/landreg" && go mod tidy 2>/dev/null
cd "$PROJ/frontend" && npm install --silent 2>/dev/null
cd "$PROJ/network"
ok "Dependencies ready"

log "Tearing down..."
docker compose --project-directory .. down -v --remove-orphans 2>/dev/null || true
docker rmi -f $(docker images -q --filter "reference=dev-peer*landreg*") 2>/dev/null || true
rm -rf organizations channel-artifacts
ok "Cleaned"

log "Generating MSP certs..."
docker run --rm -v "$(pwd):/work:Z" -w /work hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/work/crypto-config.yaml --output=/work/organizations
docker run --rm -v "$(pwd)/organizations:/orgs:Z" alpine sh -c "chown -R $(id -u):$(id -g) /orgs && chmod -R a+rX /orgs" 2>/dev/null || true
ok "Certs done"

log "Generating channel artifacts..."
mkdir -p channel-artifacts
FABRIC_CFG_PATH="$(pwd)"
docker run --rm -v "$(pwd):/work:Z" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
    configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock /work/channel-artifacts/genesis.block
docker run --rm -v "$(pwd):/work:Z" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputCreateChannelTx /work/channel-artifacts/channel.tx -channelID mychannel
docker run --rm -v "$(pwd):/work:Z" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputAnchorPeersUpdate /work/channel-artifacts/LandregMSPanchors.tx -channelID mychannel -asOrg LandregMSP
ok "Artifacts done"

log "Starting network..."
docker compose --project-directory .. build 2>&1
docker compose --project-directory .. up -d
sleep 10
ok "Network started"

ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/landreg.com/orderers/orderer.landreg.com/msp/tlscacerts/tlsca.landreg.com-cert.pem"
BLOCK="/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block"

log "Creating channel..."
docker exec cli peer channel create -o orderer.landreg.com:7050 -c mychannel --ordererTLSHostnameOverride orderer.landreg.com \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx --outputBlock "${BLOCK}" --tls --cafile "${ORDERER_CA}" 2>&1 | tail -1

for i in 0 1 2; do
    peer_at $i channel join -b "${BLOCK}" 2>&1 | tail -1 && ok "peer${i} joined"
done

peer_at 0 channel update -o orderer.landreg.com:7050 -c mychannel --ordererTLSHostnameOverride orderer.landreg.com \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/LandregMSPanchors.tx --tls --cafile "${ORDERER_CA}" 2>&1 | tail -1
ok "Anchors updated"

log "Deploying chaincode..."
CC="landreg"; CV="4.0"; CS=1; CL="${CC}_${CV}"
docker exec cli peer lifecycle chaincode package ${CC}.tar.gz \
    --path /opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/go/landreg --lang golang --label ${CL} 2>&1 | tail -1

for i in 0 1 2; do
    peer_at $i lifecycle chaincode install ${CC}.tar.gz 2>&1 | tail -1 && ok "Installed peer${i}"
done

PKG=$(docker exec cli bash -c "peer lifecycle chaincode queryinstalled | grep ${CL} | awk '{print \$3}' | tr -d ','")

for i in 0 1 2; do
    peer_at $i lifecycle chaincode approveformyorg -o orderer.landreg.com:7050 --ordererTLSHostnameOverride orderer.landreg.com \
        --tls --cafile "${ORDERER_CA}" --channelID mychannel --name ${CC} --version ${CV} --package-id ${PKG} --sequence ${CS} 2>&1 | tail -1 && ok "Approved peer${i}"
done

PA=""
for i in 0 1 2; do
    peer="peer${i}"; p=$((7051+i*1000))
    PA="${PA} --peerAddresses ${peer}.landreg.com:${p} --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/landreg.com/peers/${peer}.landreg.com/tls/ca.crt"
done

docker exec cli peer lifecycle chaincode commit -o orderer.landreg.com:7050 --ordererTLSHostnameOverride orderer.landreg.com \
    --tls --cafile "${ORDERER_CA}" --channelID mychannel --name ${CC} --version ${CV} --sequence ${CS} ${PA} 2>&1 | tail -1
ok "Chaincode committed"

log "Waiting for backend..."
for attempt in $(seq 1 20); do
    curl -sf http://localhost:8080/health >/dev/null 2>&1 && break
    sleep 2
done

API="http://localhost:8080/api/land"
AUTH="http://localhost:8080/api"

# Get admin token for seeding
log "Authenticating for seed..."
TOKEN=$(curl -sf -X POST "${AUTH}/login" -H "Content-Type: application/json" \
    -d '{"nid":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    log "WARNING: Could not get admin token, skipping seed"
else
# Seed: register lands
for attempt in $(seq 1 15); do
    curl -s -X POST "${API}" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
        -d '{"action":"register","plotId":"_probe","owner":"NID-001","location":"Seed","area":1}' 2>/dev/null | grep -q "success" && break
    sleep 2
done

for i in 1 2 3 4; do
    loc="Location${i}"
    [ $((i % 2)) -eq 1 ] && own="NID-001" || own="NID-002"
    for retry in $(seq 1 5); do
        curl -s -X POST "${API}" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
            -d "{\"action\":\"register\",\"plotId\":\"plot-00${i}\",\"owner\":\"${own}\",\"location\":\"${loc}\",\"area\":$((i*200))}" 2>/dev/null | grep -q "success" && { ok "plot-00${i}"; break; }
        sleep 2
    done
done
fi

echo ""
ok "==============================="
ok "  Land Registry LIVE"
ok "  http://localhost:3000"
ok "==============================="
