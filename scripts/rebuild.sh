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

# Helper: run a peer CLI command targeting a specific province
peer_at() {
    local i=$1; shift
    local o="province${i}" p=$((7051+(i-1)*1000)) m="Province${i}MSP"
    local msp="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/users/Admin@${o}.example.com/msp"
    local tls="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt"
    docker exec -e "CORE_PEER_MSPCONFIGPATH=${msp}" -e "CORE_PEER_ADDRESS=peer0.${o}.example.com:${p}" \
        -e "CORE_PEER_LOCALMSPID=${m}" -e "CORE_PEER_TLS_ROOTCERT_FILE=${tls}" cli bash -c "$*"
}

echo "╔══════════════════════════════════╗"
echo "║  Land Registry — Full Rebuild    ║"
echo "╚══════════════════════════════════╝"

# ── Tear down ────────────────────────────────────────────────────────
log "Killing processes on ports 8080 & 3000..."
for port in 8080 3000; do
    fuser -k ${port}/tcp 2>/dev/null || true
done

log "Tearing down..."
cd network
docker compose --project-directory .. down -v --remove-orphans 2>/dev/null || true
docker rmi -f $(docker images -q --filter "reference=dev-peer*landreg*") 2>/dev/null || true
rm -rf organizations channel-artifacts
ok "Cleaned"

# ── Crypto + channel artifacts ───────────────────────────────────────
log "Chaincode deps..."
cd ../backend/chaincode/go/landreg && go mod tidy 2>/dev/null; cd "$PROJ/network"

log "Generating MSP certs..."
docker run --rm -v "$(pwd):/work:Z" -w /work hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/work/crypto-config.yaml --output=/work/organizations
docker run --rm -v "$(pwd)/organizations:/orgs:Z" alpine sh -c "chown -R $(id -u):$(id -g) /orgs && chmod -R a+rX /orgs" 2>/dev/null || true
ok "Certs + permissions done"

log "Generating channel artifacts..."
mkdir -p channel-artifacts
FABRIC_CFG_PATH="$(pwd)"
docker run --rm -v "$(pwd):/work:Z" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
    configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock /work/channel-artifacts/genesis.block
docker run --rm -v "$(pwd):/work:Z" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputCreateChannelTx /work/channel-artifacts/channel.tx -channelID mychannel
# Anchor peer updates per org
for i in 1 2 3; do
    docker run --rm -v "$(pwd):/work:Z" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
        configtxgen -profile LandChannel -outputAnchorPeersUpdate "/work/channel-artifacts/Province${i}MSPanchors.tx" -channelID mychannel -asOrg "Province${i}MSP"
done
ok "Artifacts done"

log "Starting network (build + up)..."
docker compose --project-directory .. build 2>&1
docker compose --project-directory .. up -d
sleep 10
ok "Network started"

# ── Channel ──────────────────────────────────────────────────────────
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
BLOCK="/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block"

log "Creating channel..."
docker exec cli bash -c "peer channel create -o orderer.example.com:7050 -c mychannel --ordererTLSHostnameOverride orderer.example.com -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx --outputBlock ${BLOCK} --tls --cafile ${ORDERER_CA}" 2>&1 | tail -1

for i in 1 2 3; do
    peer_at $i "peer channel join -b ${BLOCK}" 2>&1 | tail -1 && ok "Province${i} joined"
done

for i in 1 2 3; do
    peer_at $i "peer channel update -o orderer.example.com:7050 -c mychannel --ordererTLSHostnameOverride orderer.example.com -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/Province${i}MSPanchors.tx --tls --cafile ${ORDERER_CA}" 2>&1 | tail -1
done
ok "Channel ready"

# ── Chaincode ────────────────────────────────────────────────────────
log "Deploying chaincode..."
CC="landreg"; CV="1.0"; CS=1; CL="${CC}_${CV}"
docker exec cli bash -c "peer lifecycle chaincode package ${CC}.tar.gz --path /opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/go/landreg --lang golang --label ${CL}" 2>&1 | tail -1

for i in 1 2 3; do
    peer_at $i "peer lifecycle chaincode install ${CC}.tar.gz" 2>&1 | tail -1 && ok "Installed Province${i}"
done

PKG=$(docker exec cli bash -c "peer lifecycle chaincode queryinstalled | grep ${CL} | awk '{print \$3}' | tr -d ','")

for i in 1 2 3; do
    peer_at $i "peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile ${ORDERER_CA} --channelID mychannel --name ${CC} --version ${CV} --package-id ${PKG} --sequence ${CS}" 2>&1 | tail -1 && ok "Approved Province${i}"
done

# Build commit peer args
PA=""
for i in 1 2 3; do
    o="province${i}"; p=$((7051+(i-1)*1000))
    PA="${PA} --peerAddresses peer0.${o}.example.com:${p} --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt"
done
docker exec cli bash -c "peer lifecycle chaincode commit -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile ${ORDERER_CA} --channelID mychannel --name ${CC} --version ${CV} --sequence ${CS} ${PA}" 2>&1 | tail -1
ok "Chaincode committed"

# ── Seed ─────────────────────────────────────────────────────────────
log "Waiting for backend + seeding..."
for attempt in $(seq 1 20); do
    curl -sf http://localhost:8080/health >/dev/null 2>&1 && break
    sleep 2
done
for attempt in $(seq 1 15); do
    curl -s -X POST http://localhost:8080/api/land -H "Content-Type: application/json" \
        -d '{"action":"register","plotId":"_probe","surveyNumber":"X","owner":"X","area":1}' 2>/dev/null | grep -q "success" && break
    sleep 2
done

for i in 1 2 3 4; do
    loc="Location${i}"; prov="Province$(( (i-1) % 3 + 1 ))"
    for retry in $(seq 1 5); do
        curl -s -X POST http://localhost:8080/api/land -H "Content-Type: application/json" \
            -d "{\"action\":\"register\",\"plotId\":\"plot-00${i}\",\"surveyNumber\":\"SN-${i}001\",\"owner\":\"Owner${i}\",\"location\":\"${loc}\",\"province\":\"${prov}\",\"area\":$((i*200)),\"landType\":\"residential\"}" 2>/dev/null | grep -q "success" && { ok "plot-00${i}"; break; }
        sleep 2
    done
done

echo ""
ok "======================================="
ok "  Land Registry LIVE"
ok "  http://localhost:3000"
ok "  http://localhost:8080/health"
ok "======================================="
