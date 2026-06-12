#!/bin/bash
# =============================================================================
# rebuild.sh — Full tear-down + rebuild + deploy + init (3 provinces).
# Single command:  ./scripts/rebuild.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[*]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

echo "╔══════════════════════════════════╗"
echo "║  Land Registry — Full Rebuild    ║"
echo "║  3 Provincial Full Nodes        ║"
echo "║  77 Malpots as Lite Nodes        ║"
echo "╚══════════════════════════════════╝"

# 1. Tear down
log "Tearing down..."
# Stop Go backend if running
pkill -f 'backend/server' 2>/dev/null || true
cd network
COMPOSE_PROJECT_NAME=fabric docker compose down -v --remove-orphans 2>/dev/null || true
docker rmi -f $(docker images -q --filter "reference=dev-peer*landreg*") 2>/dev/null || true
sudo rm -rf organizations channel-artifacts 2>/dev/null || true
ok "Cleaned"

# 2. Go deps
log "Chaincode deps..."
cd ../backend/chaincode/go/landreg && go mod tidy 2>/dev/null; cd ../../../../network

# 3. cryptogen
log "Generating MSP certs..."
docker run --rm -v "$(pwd):/work" -w /work hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/work/crypto-config.yaml --output=/work/organizations
# Fix root-owned files so Go backend can read private keys
sudo chown -R "$(whoami)" organizations 2>/dev/null || true
ok "Certs done"

# 4. Build configtx.yaml with 3 provinces
log "Building configtx.yaml..."
> configtx.yaml
echo "---" >> configtx.yaml
echo "Organizations:" >> configtx.yaml
ENDORSE=""; CONSORT=""; CHANN=""
for i in $(seq 1 3); do
    PORT=$((7051 + (i-1)*1000))
    cat >> configtx.yaml << EOF
  - &Province${i}
    Name: Province${i}MSP
    ID: Province${i}MSP
    MSPDir: organizations/peerOrganizations/province${i}.example.com/msp
    Policies:
      Readers: { Type: Signature, Rule: "OR('Province${i}MSP.admin','Province${i}MSP.peer','Province${i}MSP.client')" }
      Writers: { Type: Signature, Rule: "OR('Province${i}MSP.admin','Province${i}MSP.client')" }
      Admins: { Type: Signature, Rule: "OR('Province${i}MSP.admin')" }
      Endorsement: { Type: Signature, Rule: "OR('Province${i}MSP.peer')" }
    AnchorPeers:
      - Host: peer0.province${i}.example.com
        Port: ${PORT}
EOF
    [ $i -gt 1 ] && ENDORSE="${ENDORSE}, "
    ENDORSE="${ENDORSE}'Province${i}MSP.peer'"
    [ $i -gt 1 ] && { CONSORT="${CONSORT}"$'\n'; CHANN="${CHANN}"$'\n'; }
    CONSORT="${CONSORT}          - *Province${i}"
    CHANN="${CHANN}        - *Province${i}"
done

cat >> configtx.yaml << YEOF
Capabilities:
  Channel: &ChannelCapabilities { V2_0: true }
  Orderer: &OrdererCapabilities { V2_0: true }
  Application: &ApplicationCapabilities { V2_5: true }
Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers: { Type: ImplicitMeta, Rule: "ANY Readers" }
    Writers: { Type: ImplicitMeta, Rule: "ANY Writers" }
    Admins: { Type: ImplicitMeta, Rule: "MAJORITY Admins" }
    LifecycleEndorsement: { Type: ImplicitMeta, Rule: "MAJORITY Endorsement" }
    Endorsement: { Type: Signature, Rule: "OutOf(3, ${ENDORSE})" }
  Capabilities: *ApplicationCapabilities
Orderer: &OrdererDefaults
  OrdererType: etcdraft
  EtcdRaft:
    Consenters:
      - Host: orderer.example.com
        Port: 7050
        ClientTLSCert: organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
        ServerTLSCert: organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
  Addresses: [orderer.example.com:7050]
  BatchTimeout: 2s
  BatchSize: { MaxMessageCount: 10, AbsoluteMaxBytes: 99 MB, PreferredMaxBytes: 512 KB }
  Organizations:
  Policies:
    Readers: { Type: ImplicitMeta, Rule: "ANY Readers" }
    Writers: { Type: ImplicitMeta, Rule: "ANY Writers" }
    Admins: { Type: ImplicitMeta, Rule: "MAJORITY Admins" }
    BlockValidation: { Type: ImplicitMeta, Rule: "ANY Writers" }
  Capabilities: *OrdererCapabilities
Channel: &ChannelDefaults
  Policies:
    Readers: { Type: ImplicitMeta, Rule: "ANY Readers" }
    Writers: { Type: ImplicitMeta, Rule: "ANY Writers" }
    Admins: { Type: ImplicitMeta, Rule: "MAJORITY Admins" }
  Capabilities: *ChannelCapabilities
Profiles:
  OrdererGenesis:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - &OrdererOrg
          Name: OrdererOrg
          ID: OrdererMSP
          MSPDir: organizations/ordererOrganizations/example.com/msp
          Policies:
            Readers: { Type: Signature, Rule: "OR('OrdererMSP.member')" }
            Writers: { Type: Signature, Rule: "OR('OrdererMSP.member')" }
            Admins: { Type: Signature, Rule: "OR('OrdererMSP.admin')" }
          OrdererEndpoints: [orderer.example.com:7050]
      Capabilities: *OrdererCapabilities
    Consortiums:
      LandConsortium:
        Organizations:
${CONSORT}
  LandChannel:
    Consortium: LandConsortium
    <<: *ChannelDefaults
    Application:
      <<: *ApplicationDefaults
      Organizations:
${CHANN}
      Capabilities: *ApplicationCapabilities
YEOF
ok "configtx.yaml generated"

# 5. configtxgen
log "Generating genesis block..."
mkdir -p channel-artifacts
export FABRIC_CFG_PATH="$(pwd)"
docker run --rm -v "$(pwd):/work" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
    configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock /work/channel-artifacts/genesis.block
docker run --rm -v "$(pwd):/work" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputCreateChannelTx /work/channel-artifacts/channel.tx -channelID mychannel
for i in $(seq 1 3); do
    docker run --rm -v "$(pwd):/work" -w /work -e FABRIC_CFG_PATH=/work hyperledger/fabric-tools:2.5 \
        configtxgen -profile LandChannel -outputAnchorPeersUpdate "/work/channel-artifacts/Province${i}MSPanchors.tx" -channelID mychannel -asOrg "Province${i}MSP"
done
ok "Channel artifacts done"

# 6. Start network
log "Starting 3 provincial peers..."
COMPOSE_PROJECT_NAME=fabric docker compose up -d
sleep 10
ok "Network started"

# 7. Channel join
log "Creating channel..."
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
docker exec cli bash -c "export ORDERER_CA=${ORDERER_CA}; peer channel create -o orderer.example.com:7050 -c mychannel --ordererTLSHostnameOverride orderer.example.com -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block --tls --cafile \$ORDERER_CA" 2>&1 | tail -2

for i in $(seq 1 3); do
    o="province${i}"; p=$((7051+(i-1)*1000))
    docker exec -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/users/Admin@${o}.example.com/msp" \
        -e "CORE_PEER_ADDRESS=peer0.${o}.example.com:${p}" -e "CORE_PEER_LOCALMSPID=Province${i}MSP" \
        -e "CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt" \
        cli bash -c "peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/mychannel.block" 2>&1 | tail -1
    ok "Province${i} joined"
done

# 8. Anchor peers
for i in $(seq 1 3); do
    o="province${i}"; p=$((7051+(i-1)*1000)); m="Province${i}MSP"
    docker exec -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/users/Admin@${o}.example.com/msp" \
        -e "CORE_PEER_ADDRESS=peer0.${o}.example.com:${p}" -e "CORE_PEER_LOCALMSPID=${m}" \
        -e "CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt" \
        cli bash -c "export ORDERER_CA=${ORDERER_CA}; peer channel update -o orderer.example.com:7050 -c mychannel --ordererTLSHostnameOverride orderer.example.com -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${m}anchors.tx --tls --cafile \$ORDERER_CA" 2>&1 | tail -1
done
ok "Anchors updated"

# 9. Deploy chaincode
log "Deploying landreg chaincode..."
CC="landreg"; CV="1.0"; CS=1; CL="${CC}_${CV}"
peer_cmd() { docker exec cli bash -c "$1"; }
peer_cmd "peer lifecycle chaincode package ${CC}.tar.gz --path /opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/go/landreg --lang golang --label ${CL}" 2>&1 | tail -1

for i in $(seq 1 3); do
    o="province${i}"; p=$((7051+(i-1)*1000))
    if [ $i -eq 1 ]; then peer_cmd "peer lifecycle chaincode install ${CC}.tar.gz" 2>&1 | tail -1
    else docker exec -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/users/Admin@${o}.example.com/msp" \
        -e "CORE_PEER_ADDRESS=peer0.${o}.example.com:${p}" -e "CORE_PEER_LOCALMSPID=Province${i}MSP" \
        -e "CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt" \
        cli bash -c "peer lifecycle chaincode install ${CC}.tar.gz" 2>&1 | tail -1; fi
    ok "Installed Province${i}"
done

PKG=$(peer_cmd "peer lifecycle chaincode queryinstalled | grep ${CL} | awk '{print \$3}' | tr -d ','")

for i in $(seq 1 3); do
    o="province${i}"; p=$((7051+(i-1)*1000))
    if [ $i -eq 1 ]; then peer_cmd "peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile ${ORDERER_CA} --channelID mychannel --name ${CC} --version ${CV} --package-id ${PKG} --sequence ${CS}" 2>&1 | tail -1
    else docker exec -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/users/Admin@${o}.example.com/msp" \
        -e "CORE_PEER_ADDRESS=peer0.${o}.example.com:${p}" -e "CORE_PEER_LOCALMSPID=Province${i}MSP" \
        -e "CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt" \
        cli bash -c "peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile ${ORDERER_CA} --channelID mychannel --name ${CC} --version ${CV} --package-id ${PKG} --sequence ${CS}" 2>&1 | tail -1; fi
    ok "Approved Province${i}"
done

# Commit
PA=""
for i in 1 2 3; do
    o="province${i}"; p=$((7051+(i-1)*1000))
    PA="${PA} --peerAddresses peer0.${o}.example.com:${p} --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt"
done
peer_cmd "peer lifecycle chaincode commit -o orderer.example.com:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile ${ORDERER_CA} --channelID mychannel --name ${CC} --version ${CV} --sequence ${CS} ${PA}" 2>&1 | tail -1
ok "Chaincode committed"

# 10. Build & start Go backend
log "Building Go backend (Fabric Gateway SDK)..."
cd ../backend
pkill -f 'backend/server' 2>/dev/null || true
go mod tidy 2>&1
go build -o server . 2>&1
if [ $? -eq 0 ]; then
    ok "Go backend built"
    PROJECT_ROOT="$(pwd)/.." nohup ./server > backend.log 2>&1 &
    sleep 2
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        ok "Go backend running on :8080"
    else
        log "Go backend may still be starting (check backend/backend.log)"
    fi
else
    log "Go build failed - cannot seed"
    exit 1
fi
cd ..

# 11. Seed samples via Go backend (not docker exec CLI)
log "Seeding sample plots via Go backend..."
# Wait for gateway to be ready for transactions (not just health)
for attempt in $(seq 1 15); do
    if curl -s -X POST http://localhost:8080/api/land         -H "Content-Type: application/json"         -d '{"action":"register","plotId":"_probe","surveyNumber":"X","owner":"X","area":1}' 2>/dev/null | grep -q "success"; then
        ok "Gateway ready (attempt $attempt)"
        break
    fi
    sleep 2
done
for i in $(seq 1 4); do
    loc="Location${i}"
    prov="Province$(( (i-1) % 3 + 1 ))"
    for retry in $(seq 1 5); do
        if curl -s -X POST http://localhost:8080/api/land \
            -H "Content-Type: application/json" \
            -d "{\"action\":\"register\",\"plotId\":\"plot-00${i}\",\"surveyNumber\":\"SN-${i}001\",\"owner\":\"Owner${i}\",\"location\":\"${loc}\",\"province\":\"${prov}\",\"area\":$((i*200)),\"landType\":\"residential\"}" 2>/dev/null | grep -q "success"; then
            ok "  plot-00${i}"
            break
        fi
        sleep 2
    done
done
ok "Seeded 4 sample plots via Go backend"

echo ""
ok "======================================="
ok "  Land Registry is LIVE!"
ok "  Frontend : http://localhost:3000"
ok "  Backend  : http://localhost:8080"
ok "  Health   : http://localhost:8080/health"
ok "======================================="
