#!/bin/bash
# =============================================================================
# deploy-cc.sh — Package, install, approve, and commit chaincode.
#
# Run AFTER the network is up:  ./scripts/deploy-cc.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")/network"
CHAINCODE_DIR="$(dirname "$SCRIPT_DIR")/chaincode/go/basic"
CC_NAME="basic"
CC_VERSION="1.0"
CC_SEQUENCE=1
CHANNEL="mychannel"

cd "$NETWORK_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║   Deploying Chaincode: ${CC_NAME} v${CC_VERSION}    ║"
echo "╚══════════════════════════════════════════╝"

# ── Helper: run a peer command inside CLI ────────────────────────────
peer_cmd() {
    docker exec cli bash -c "$1"
}

ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
PEER_ORG1_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
PEER_ORG2_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"

CC_PATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/go/basic"
CC_LABEL="${CC_NAME}_${CC_VERSION}"

# ── 1. Package chaincode ─────────────────────────────────────────────
echo ""
echo "▶ Step 1/5: Packaging chaincode..."
peer_cmd "
    peer lifecycle chaincode package ${CC_NAME}.tar.gz \
        --path ${CC_PATH} \
        --lang golang \
        --label ${CC_LABEL}
"
echo "  ✔ Chaincode packaged → ${CC_NAME}.tar.gz"

# ── 2. Install on Org1 peer ─────────────────────────────────────────
echo ""
echo "▶ Step 2/5: Installing on Org1 peer..."
peer_cmd "
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
"
echo "  ✔ Installed on Org1"

# Query package ID
PACKAGE_ID=$(peer_cmd "
    peer lifecycle chaincode queryinstalled | grep ${CC_LABEL} | awk '{print \$3}' | tr -d ','
")
echo "  Package ID: ${PACKAGE_ID}"

# ── 2b. Install on Org2 peer ────────────────────────────────────────
echo ""
echo "▶ Step 2b/5: Installing on Org2 peer..."
docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 \
    -e CORE_PEER_LOCALMSPID=Org2MSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER_ORG2_TLS} \
    cli bash -c "
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
"
echo "  ✔ Installed on Org2"

# ── 3. Approve for Org1 ─────────────────────────────────────────────
echo ""
echo "▶ Step 3/5: Approving chaincode for Org1..."
peer_cmd "
    peer lifecycle chaincode approveformyorg \
        -o orderer.example.com:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile ${ORDERER_CA} \
        --channelID ${CHANNEL} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --package-id ${PACKAGE_ID} \
        --sequence ${CC_SEQUENCE}
"
echo "  ✔ Approved for Org1"

# ── 3b. Approve for Org2 ────────────────────────────────────────────
echo ""
echo "▶ Step 3b/5: Approving chaincode for Org2..."
docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 \
    -e CORE_PEER_LOCALMSPID=Org2MSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=${PEER_ORG2_TLS} \
    cli bash -c "
    peer lifecycle chaincode approveformyorg \
        -o orderer.example.com:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile ${ORDERER_CA} \
        --channelID ${CHANNEL} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --package-id ${PACKAGE_ID} \
        --sequence ${CC_SEQUENCE}
"
echo "  ✔ Approved for Org2"

# ── 4. Check commit readiness ───────────────────────────────────────
echo ""
echo "▶ Step 4/5: Checking commit readiness..."
peer_cmd "
    peer lifecycle chaincode checkcommitreadiness \
        --channelID ${CHANNEL} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --sequence ${CC_SEQUENCE} \
        --output json
"
echo "  ✔ Both orgs ready"

# ── 5. Commit chaincode ─────────────────────────────────────────────
echo ""
echo "▶ Step 5/5: Committing chaincode..."
peer_cmd "
    peer lifecycle chaincode commit \
        -o orderer.example.com:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile ${ORDERER_CA} \
        --channelID ${CHANNEL} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --sequence ${CC_SEQUENCE} \
        --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles ${PEER_ORG1_TLS} \
        --peerAddresses peer0.org2.example.com:9051 --tlsRootCertFiles ${PEER_ORG2_TLS}
"
echo "  ✔ Chaincode committed to channel"

# ── Auto-initialize the ledger so the frontend works immediately ──
echo ""
echo "▶ Initializing ledger with sample assets..."
peer_cmd "
    peer chaincode invoke \
        -o orderer.example.com:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile ${ORDERER_CA} \
        --channelID ${CHANNEL} \
        --name ${CC_NAME} \
        --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles ${PEER_ORG1_TLS} \
        --peerAddresses peer0.org2.example.com:9051 --tlsRootCertFiles ${PEER_ORG2_TLS} \
        -c '{\"function\":\"InitLedger\",\"Args\":[]}'
" 2>&1 | grep -v "^$"
echo "  ✔ Ledger initialized"

# ── Verify ──────────────────────────────────────────────────────────
echo ""
echo "▶ Verifying committed chaincode..."
peer_cmd "
    peer lifecycle chaincode querycommitted --channelID ${CHANNEL} --name ${CC_NAME}
"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Chaincode deployed successfully!       ║"
echo "║                                          ║"
echo "║   Next: Initialize the ledger:           ║"
echo "║     cd application && npm run invoke --  ║"
echo "║       alice InitLedger                   ║"
echo "╚══════════════════════════════════════════╝"
