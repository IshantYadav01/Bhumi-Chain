#!/bin/bash
# =============================================================================
# deploy-cc.sh — Package, install, approve, and commit chaincode.
#
# Run AFTER the network is up:  ./scripts/deploy-cc.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")/network"
CHAINCODE_DIR="$(dirname "$SCRIPT_DIR")/backend/chaincode/go/landreg"
CC_NAME="landreg"
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

# TLS root certs for all 5 orgs
PEER_MUNICIPALITY_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/municipality.example.com/peers/peer0.municipality.example.com/tls/ca.crt"
PEER_MALPOT_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/malpot.example.com/peers/peer0.malpot.example.com/tls/ca.crt"
PEER_SURVEY_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/survey.example.com/peers/peer0.survey.example.com/tls/ca.crt"
PEER_LANDREGISTRY_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/landregistry.example.com/peers/peer0.landregistry.example.com/tls/ca.crt"
PEER_FINANCE_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/finance.example.com/peers/peer0.finance.example.com/tls/ca.crt"

CC_PATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/go/landreg"
CC_LABEL="${CC_NAME}_${CC_VERSION}"

# MSP config paths for each org admin
MSP_MUNICIPALITY="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/municipality.example.com/users/Admin@municipality.example.com/msp"
MSP_MALPOT="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/malpot.example.com/users/Admin@malpot.example.com/msp"
MSP_SURVEY="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/survey.example.com/users/Admin@survey.example.com/msp"
MSP_LANDREGISTRY="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/landregistry.example.com/users/Admin@landregistry.example.com/msp"
MSP_FINANCE="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/finance.example.com/users/Admin@finance.example.com/msp"

# ── 1. Package chaincode ─────────────────────────────────────────────
echo ""
echo "▶ Step 1/7: Packaging chaincode..."
peer_cmd "
    peer lifecycle chaincode package ${CC_NAME}.tar.gz \
        --path ${CC_PATH} \
        --lang golang \
        --label ${CC_LABEL}
"
echo "  ✔ Chaincode packaged → ${CC_NAME}.tar.gz"

# ── 2. Install on all 5 peers ───────────────────────────────────────
echo ""
echo "▶ Step 2/7: Installing on all 5 peers..."

# 2a. Municipality (CLI defaults to this peer)
echo "  Installing on Municipality..."
peer_cmd "
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
"
echo "    ✔ Municipality"

# Query package ID
PACKAGE_ID=$(peer_cmd "
    peer lifecycle chaincode queryinstalled | grep ${CC_LABEL} | awk '{print \$3}' | tr -d ','
")
echo "  Package ID: ${PACKAGE_ID}"

# 2b. Malpot
echo "  Installing on Malpot..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH="${MSP_MALPOT}" \
    -e CORE_PEER_ADDRESS=peer0.malpot.example.com:8051 \
    -e CORE_PEER_LOCALMSPID=MalpotMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE="${PEER_MALPOT_TLS}" \
    cli bash -c "
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
"
echo "    ✔ Malpot"

# 2c. Survey
echo "  Installing on Survey..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH="${MSP_SURVEY}" \
    -e CORE_PEER_ADDRESS=peer0.survey.example.com:9051 \
    -e CORE_PEER_LOCALMSPID=SurveyMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE="${PEER_SURVEY_TLS}" \
    cli bash -c "
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
"
echo "    ✔ Survey"

# 2d. LandRegistry
echo "  Installing on LandRegistry..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH="${MSP_LANDREGISTRY}" \
    -e CORE_PEER_ADDRESS=peer0.landregistry.example.com:10051 \
    -e CORE_PEER_LOCALMSPID=LandRegistryMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE="${PEER_LANDREGISTRY_TLS}" \
    cli bash -c "
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
"
echo "    ✔ LandRegistry"

# 2e. Finance
echo "  Installing on Finance..."
docker exec \
    -e CORE_PEER_MSPCONFIGPATH="${MSP_FINANCE}" \
    -e CORE_PEER_ADDRESS=peer0.finance.example.com:11051 \
    -e CORE_PEER_LOCALMSPID=FinanceMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE="${PEER_FINANCE_TLS}" \
    cli bash -c "
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
"
echo "    ✔ Finance"

# ── 3. Approve for all 5 orgs ───────────────────────────────────────
echo ""
echo "▶ Step 3/7: Approving chaincode for all 5 orgs..."

approve() {
    local ORG_DOMAIN="$1"    # e.g. municipality
    local MSP_ID="$2"        # e.g. MunicipalityMSP
    local PEER_PORT="$3"     # e.g. 7051
    local TLS_CERT="$4"      # TLS root cert path

    docker exec \
        -e CORE_PEER_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${ORG_DOMAIN}.example.com/users/Admin@${ORG_DOMAIN}.example.com/msp" \
        -e CORE_PEER_ADDRESS="peer0.${ORG_DOMAIN}.example.com:${PEER_PORT}" \
        -e CORE_PEER_LOCALMSPID="${MSP_ID}" \
        -e CORE_PEER_TLS_ROOTCERT_FILE="${TLS_CERT}" \
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
}

echo "  Approving for Municipality..."
approve "municipality" "MunicipalityMSP" "7051" "${PEER_MUNICIPALITY_TLS}"
echo "    ✔ Municipality"

echo "  Approving for Malpot..."
approve "malpot" "MalpotMSP" "8051" "${PEER_MALPOT_TLS}"
echo "    ✔ Malpot"

echo "  Approving for Survey..."
approve "survey" "SurveyMSP" "9051" "${PEER_SURVEY_TLS}"
echo "    ✔ Survey"

echo "  Approving for LandRegistry..."
approve "landregistry" "LandRegistryMSP" "10051" "${PEER_LANDREGISTRY_TLS}"
echo "    ✔ LandRegistry"

echo "  Approving for Finance..."
approve "finance" "FinanceMSP" "11051" "${PEER_FINANCE_TLS}"
echo "    ✔ Finance"

# ── 4. Check commit readiness ───────────────────────────────────────
echo ""
echo "▶ Step 4/7: Checking commit readiness..."
peer_cmd "
    peer lifecycle chaincode checkcommitreadiness \
        --channelID ${CHANNEL} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --sequence ${CC_SEQUENCE} \
        --output json
"
echo "  ✔ All orgs ready"

# ── 5. Commit chaincode with endorsement policy ─────────────────────
# Endorsement policy: 3 out of Municipality/Malpot/Survey must endorse
ENDORSEMENT_POLICY="OutOf(3, 'MunicipalityMSP.peer', 'MalpotMSP.peer', 'SurveyMSP.peer')"

echo ""
echo "▶ Step 5/7: Committing chaincode..."
peer_cmd "
    peer lifecycle chaincode commit \
        -o orderer.example.com:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile ${ORDERER_CA} \
        --channelID ${CHANNEL} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --sequence ${CC_SEQUENCE} \
        --signature-policy \"${ENDORSEMENT_POLICY}\" \
        --peerAddresses peer0.municipality.example.com:7051 --tlsRootCertFiles ${PEER_MUNICIPALITY_TLS} \
        --peerAddresses peer0.malpot.example.com:8051 --tlsRootCertFiles ${PEER_MALPOT_TLS} \
        --peerAddresses peer0.survey.example.com:9051 --tlsRootCertFiles ${PEER_SURVEY_TLS} \
        --peerAddresses peer0.landregistry.example.com:10051 --tlsRootCertFiles ${PEER_LANDREGISTRY_TLS} \
        --peerAddresses peer0.finance.example.com:11051 --tlsRootCertFiles ${PEER_FINANCE_TLS}
"
echo "  ✔ Chaincode committed to channel"

# ── 6. Wait for chaincode to be ready ───────────────────────────────
echo ""
echo "▶ Step 6/7: Waiting for chaincode to initialize..."
sleep 3

# ── 7. Auto-initialize ledger with 4 sample land records ────────────
echo ""
echo "▶ Step 7/7: Registering sample land records..."

register_land() {
    local PLOT_ID="$1"
    local SURVEY_NO="$2"
    local OWNER="$3"
    local LOCATION="$4"
    local AREA="$5"
    local LAND_TYPE="$6"

    echo "  Registering ${PLOT_ID} (${OWNER}, ${LOCATION})..."
    peer_cmd "
        peer chaincode invoke \
            -o orderer.example.com:7050 \
            --ordererTLSHostnameOverride orderer.example.com \
            --tls --cafile ${ORDERER_CA} \
            --channelID ${CHANNEL} \
            --name ${CC_NAME} \
            --peerAddresses peer0.municipality.example.com:7051 --tlsRootCertFiles ${PEER_MUNICIPALITY_TLS} \
            --peerAddresses peer0.malpot.example.com:8051 --tlsRootCertFiles ${PEER_MALPOT_TLS} \
            --peerAddresses peer0.survey.example.com:9051 --tlsRootCertFiles ${PEER_SURVEY_TLS} \
            -c '{\"function\":\"RegisterLand\",\"Args\":[\"${PLOT_ID}\",\"${SURVEY_NO}\",\"${OWNER}\",\"${LOCATION}\",\"${AREA}\",\"${LAND_TYPE}\"]}'
    " 2>&1 | grep -v "^$"
}

register_land "plot-001" "SN-1001" "Ram Bahadur" "Kathmandu-01" "500.0" "residential"
register_land "plot-002" "SN-1002" "Sita Devi"   "Lalitpur-05"  "1200.0" "commercial"
register_land "plot-003" "SN-1003" "Hari Prasad" "Bhaktapur-03" "800.0" "agricultural"
register_land "plot-004" "SN-1004" "Gita Kumari" "Pokhara-07"   "350.0" "residential"

echo "  ✔ All 4 sample land records registered"

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
echo "║   Chaincode: ${CC_NAME} v${CC_VERSION}              ║"
echo "║   Endorsement: 3-of Municipality/Malpot  ║"
echo "║               /Survey                     ║"
echo "║   4 sample land records registered       ║"
echo "╚══════════════════════════════════════════╝"
