# Land Registry — Private Blockchain System

A **Hyperledger Fabric** land registry with **5 department full nodes**, **unlimited lite nodes** (buyers, sellers, officials), mortgage tracking, and legal dispute management.

Land transfers require **tri-department endorsement** from Municipality, Malpot, and Survey departments.

## Architecture

```
                         Ordering Service (RAFT)
                       orderer.example.com:7050
                                  │
     ┌──────────┬──────────┬──────┼──────┬──────────┐
     │          │          │      │      │          │
  Municipality Malpot   Survey  LandReg  Finance  │
  (Full Node) (Full N) (Full N)(Full N)(Full N)  │  5 departments
     │          │          │      │      │        │
     └──────────┴──────────┼──────┴──────┘        │
                           │                      │
              ┌────────────┼────────────┐         │
              │            │            │         │
           Buyer        Seller      Officials      │
         (Lite Node)  (Lite Node)  (Lite Nodes)    │  ← unlimited
              │            │            │         │
              └────────────┼────────────┘         │
                           │                      │
                    ┌──────▼──────┐               │
                    │  Next.js UI │               │
                    │  :3000      │               │
                    └─────────────┘               │
                                                  │
     ... scale to 11 departments by adding 6 more peer orgs
```

| Component | What it is | Scale |
|-----------|-----------|-------|
| **Full node** | Department peer — holds full ledger, endorses transactions | 5 (scale to 11) |
| **Lite node** | Buyer, seller, or official — submits transactions via SDK / UI | Unlimited |
| **Orderer** | RAFT-based ordering service | 1 (dev) / 3–5 (prod) |
| **Frontend** | Next.js land registry dashboard | 1 browser tab |

**Land transfer flow**: Buyer → Seller → endorsed by **Municipality + Malpot + Survey** (3-of-3 observer endorsement).

Land can be **mortgaged** or in **legal dispute** — both states are recorded on the ledger and visible in the UI.

---

## Prerequisites

| Tool | Minimum | Check |
|------|---------|-------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| Go | 1.21+ | `go version` |

> You do **not** need Hyperledger Fabric binaries installed. `cryptogen`, `configtxgen`, and `peer` run inside Docker containers.

---

## Quick Start (5 minutes)

```bash
# 1. Generate crypto + channel artifacts for 5 department orgs
./scripts/generate.sh

# 2. Start full nodes (orderer + 5 department peers)
./scripts/start.sh

# 3. Deploy land registry chaincode + seed 4 sample plots
./scripts/deploy-cc.sh

# 4. Start the frontend
cd frontend && npm install && npm run dev
```

Open **http://localhost:3000** — the land registry dashboard.

The network is live with:
- `orderer.example.com:7050`
- `peer0.municipality.example.com:7051`
- `peer0.malpot.example.com:8051`
- `peer0.survey.example.com:9051`
- `peer0.landregistry.example.com:10051`
- `peer0.finance.example.com:11051`

---

## Project Layout

```
ndhack/
├── network/                          # Fabric network definition
│   ├── docker-compose.yaml           # Containers: orderer, peers, CLI
│   ├── crypto-config.yaml            # Org structure → generates MSP certs
│   ├── configtx.yaml                 # Channel, genesis, consortium config
│   ├── core.yaml                     # Peer config reference
│   └── orderer.yaml                  # Orderer config reference
│
├── chaincode/go/basic/               # Smart contract (Go)
│   ├── basic.go                      # Asset CRUD + transfer
│   ├── go.mod                        # Module definition
│   └── go.sum                        # Dependency checksums
│
├── application/                      # Lite-node SDK client (Node.js)
│   ├── package.json
│   └── src/
│       ├── connect.js                # Connection profile + Fabric SDK helpers
│       ├── enrollAdmin.js            # Enroll org admin with Fabric CA
│       ├── registerUser.js           # Register a lite-node user identity
│       ├── invoke.js                 # Submit transactions from CLI
│       ├── query.js                  # Read-only ledger queries
│       ├── app.js                    # Multi-lite-node concurrent demo
│       └── quick-test.js             # Standalone integration test
│
├── frontend/                         # Next.js dashboard (web UI)
│   ├── package.json
│   ├── next.config.js
│   ├── jsconfig.json
│   ├── lib/fabric.js                 # CLI-based Fabric backend
│   └── app/
│       ├── layout.js                 # Root layout (dark theme)
│       ├── page.js                   # Main asset manager UI
│       └── api/assets/route.js       # REST API (GET + POST)
│
├── scripts/
│   ├── generate.sh                   # cryptogen + configtxgen
│   ├── start.sh                      # docker compose up + channel join
│   ├── deploy-cc.sh                  # Package → install → approve → commit
│   └── stop.sh                       # docker compose down (+ optional clean)
│
├── config/env.sh                     # Tunable variables (org count, etc.)
├── .gitignore
├── README.md                         # ← you are here
└── DETAILS.md                        # AI / contributor reference
```

---

## Working with the Frontend

Start it:

```bash
cd frontend
npm install
npm run dev          # → http://localhost:3001
```

The dashboard shows:

| Feature | How |
|---------|-----|
| **Asset table** | Auto-refreshes every 8 seconds |
| **Create asset** | Fill the form at the bottom, click "Create Asset" |
| **Update asset** | Click a row → form pre-fills → edit → "Update Asset" |
| **Transfer** | Enter asset ID + new owner in the Quick Transfer box |
| **Delete** | Click the red **Del** button on any row |
| **Init Ledger** | Click "Init Ledger" to seed 4 sample assets |
| **Status dot** | Green = connected, Red = network down |

The frontend talks to the Fabric network through the `cli` Docker container. No Fabric SDK needed in the browser.

---

## CLI: Quick Operations

The admin CLI container is always running. Use it directly:

```bash
# Query all assets
docker exec cli peer chaincode query -C mychannel -n basic \
  -c '{"function":"GetAllAssets","Args":[]}'

# Create an asset (writes need both peers for endorsement)
docker exec cli peer chaincode invoke \
  -o orderer.example.com:7050 --tls \
  --cafile /opt/gopath/.../tlsca.example.com-cert.pem \
  -C mychannel -n basic \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles /opt/gopath/.../ca.crt \
  --peerAddresses peer0.org2.example.com:9051 \
  --tlsRootCertFiles /opt/gopath/.../ca.crt \
  -c '{"function":"CreateAsset","Args":["myId","Owner","500","blue","10"]}'

# Check channel height
docker exec cli peer channel getinfo -c mychannel
```

---

## Chaincode API (landreg)

| Function | Type | Arguments |
|----------|------|-----------|
| `RegisterLand` | Write | `plotId`, `surveyNumber`, `owner`, `location`, `area`, `landType` |
| `TransferLand` | Write | `plotId`, `buyer`, `price` |
| `SetMortgage` | Write | `plotId`, `bank`, `amount`, `startDate`, `endDate` |
| `ClearMortgage` | Write | `plotId` |
| `FileDispute` | Write | `plotId`, `caseNumber`, `court`, `description` |
| `ResolveDispute` | Write | `plotId` |
| `QueryLand` | Read | `plotId` |
| `GetLandByOwner` | Read | `owner` |
| `GetLandByStatus` | Read | `status` |
| `GetAllLand` | Read | _(none)_ |

**Endorsement**: `OutOf(3, MunicipalityMSP, MalpotMSP, SurveyMSP)` — land transfers require all 3 observers.

**Land states**: `active` → can be sold | `mortgaged` → blocked until cleared | `disputed` → blocked until resolved

---

## Adding More Full Nodes

### New organisation (Org3)

Edit these files **before** running `generate.sh`:

1. **`network/crypto-config.yaml`** — Add under `PeerOrgs`:
   ```yaml
   - Name: Org3
     Domain: org3.example.com
     EnableNodeOUs: true
     Template: { Count: 1 }
     Users: { Count: 1 }
   ```

2. **`network/configtx.yaml`** — Add `&Org3` anchor, add to `SampleConsortium` + `ChannelDemo` profile.

3. **`network/docker-compose.yaml`** — Copy-paste a peer service block, rename to `peer0.org3.example.com`, use new ports (e.g. `11051`/`11052`).

4. **`scripts/generate.sh`** — Add an anchor-peer generation line for `org3`.

5. **`scripts/start.sh`** — Add channel-join and anchor-peer-update commands for Org3.

6. **`scripts/deploy-cc.sh`** — Add an install block for the Org3 peer.

7. **`frontend/lib/fabric.js`** — If using invoke from the frontend, add the Org3 peer addresses to the `cliInvoke` command.

### More peers per org

In `crypto-config.yaml`, increase `Template.Count`. In `docker-compose.yaml`, duplicate the peer service with adjusted names and incrementing port numbers.

---

## Adding More Lite Nodes

Lite nodes are just Node.js processes. For each one:

```bash
cd application
npm run enroll Org1                       # once per org
npm run register <unique-username> Org1   # once per lite node
npm run invoke -- <username> GetAllAssets  # use it!
```

You can run hundreds of lite nodes concurrently — they all share the same full-node peers.

---

## Useful Commands

```bash
# Logs
docker logs peer0.org1.example.com -f
docker logs orderer.example.com -f

# Enter admin shell
docker exec -it cli bash

# List installed chaincodes on a peer
docker exec cli peer lifecycle chaincode queryinstalled

# List committed chaincodes on channel
docker exec cli peer lifecycle chaincode querycommitted -C mychannel

# Channel info
docker exec cli peer channel getinfo -c mychannel

# Fetch latest block
docker exec cli peer channel fetch newest -c mychannel

# Tear down everything
./scripts/stop.sh --clean
```

---

## Production Readiness

This project uses `cryptogen` for simplicity. For real deployments:

- **Fabric CA** — Replace `cryptogen` with a proper Certificate Authority for dynamic identity management
- **RAFT cluster** — Run 3 or 5 orderer nodes (edit `configtx.yaml` + `docker-compose.yaml`)
- **CouchDB** — Set `CORE_LEDGER_STATE_STATEDATABASE=CouchDB` for rich JSON queries
- **TLS from real CA** — Use Let's Encrypt or enterprise PKI instead of `cryptogen` certs
- **Hardware** — 2 GB RAM per peer, 1 GB per orderer (minimum)

---

## License

Apache-2.0
