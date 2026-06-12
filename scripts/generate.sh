#!/bin/bash
# =============================================================================
# generate.sh — Bootstrap crypto material, genesis block, and channel artifacts.
#
# Prerequisites:
#   - hyperledger/fabric-tools Docker image (pulled automatically by docker compose)
#   - cryptogen, configtxgen available (provided by fabric-tools image)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")/network"

cd "$NETWORK_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║   Generating Crypto & Channel Artifacts  ║"
echo "╚══════════════════════════════════════════╝"

# ── 1. Generate MSP material via cryptogen ───────────────────────────
echo ""
echo "▶ Step 1/3: Generating MSP certificates..."
if [ -d organizations/peerOrganizations ] || [ -d organizations/ordererOrganizations ]; then
    echo "  ⚠ MSP material already exists — skipping cryptogen."
    echo "  Run 'rm -rf organizations' first if you want fresh certs."
else
    docker run --rm \
        -v "$(pwd):/work" \
        -w /work \
        hyperledger/fabric-tools:2.5 \
        cryptogen generate --config=/work/crypto-config.yaml --output=/work/organizations
    echo "  ✔ MSP material generated in organizations/"
fi

# ── 2. Generate genesis block for the ordering service ──────────────
echo ""
echo "▶ Step 2/3: Generating genesis block..."
mkdir -p channel-artifacts

# Set FABRIC_CFG_PATH so configtxgen finds configtx.yaml
export FABRIC_CFG_PATH="$NETWORK_DIR"

docker run --rm \
    -v "$(pwd):/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock /work/channel-artifacts/genesis.block

echo "  ✔ genesis.block written to channel-artifacts/"

# ── 3. Generate channel creation transaction ────────────────────────
echo ""
echo "▶ Step 3/3: Generating channel transaction..."
docker run --rm \
    -v "$(pwd):/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputCreateChannelTx /work/channel-artifacts/channel.tx -channelID mychannel

echo "  ✔ channel.tx written to channel-artifacts/"

# ── Anchor peer updates for all 5 department orgs ───────────────────
# configtxgen lowercases the MSP name in the output filename
# (e.g. MunicipalityMSP → municipalityMSPanchors.tx)
echo ""
echo "▶ Generating anchor peer updates for all 5 orgs..."

# Municipality
docker run --rm \
    -v "$(pwd):/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputAnchorPeersUpdate /work/channel-artifacts/municipalityMSPanchors.tx -channelID mychannel -asOrg MunicipalityMSP
echo "  ✔ municipalityMSPanchors.tx written"

# Malpot
docker run --rm \
    -v "$(pwd):/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputAnchorPeersUpdate /work/channel-artifacts/malpotMSPanchors.tx -channelID mychannel -asOrg MalpotMSP
echo "  ✔ malpotMSPanchors.tx written"

# Survey
docker run --rm \
    -v "$(pwd):/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputAnchorPeersUpdate /work/channel-artifacts/surveyMSPanchors.tx -channelID mychannel -asOrg SurveyMSP
echo "  ✔ surveyMSPanchors.tx written"

# LandRegistry
docker run --rm \
    -v "$(pwd):/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputAnchorPeersUpdate /work/channel-artifacts/landregistryMSPanchors.tx -channelID mychannel -asOrg LandRegistryMSP
echo "  ✔ landregistryMSPanchors.tx written"

# Finance
docker run --rm \
    -v "$(pwd):/work" \
    -w /work \
    -e FABRIC_CFG_PATH=/work \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LandChannel -outputAnchorPeersUpdate /work/channel-artifacts/financeMSPanchors.tx -channelID mychannel -asOrg FinanceMSP
echo "  ✔ financeMSPanchors.tx written"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   All artifacts generated successfully   ║"
echo "╚══════════════════════════════════════════╝"
