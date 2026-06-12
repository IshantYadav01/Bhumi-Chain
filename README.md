# Land Registry — Private Blockchain System

A **Hyperledger Fabric** land registry on a private blockchain. **3 provincial governing bodies** run full nodes. **77 malpots**, buyers, sellers, municipalities, and survey departments connect as lite nodes.

Land records track ownership, mortgages, and legal disputes. Transfers require endorsement from **all 3 provincial peers** (100% consensus for test; 75% — 9 of 11 — for production).

## Architecture

```
                    Ordering Service (RAFT)
                  orderer.example.com:7050
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
     Province 1         Province 2         Province 3     ← 3 full nodes (test)
     :7051              :8051              :9051          ← scale to 11 for prod
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
       Buyer              Seller           77 Malpots       ← lite nodes
    (Lite Node)        (Lite Node)       (Lite Nodes)       ← unlimited
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Go Backend     │   ← Fabric Gateway SDK (gRPC)
                    │  localhost:8080 │   ← per-user X.509 signing
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Next.js UI     │
                    │  localhost:3000 │
                    └─────────────────┘
```

| Layer | Who | Count | Runs |
|-------|-----|-------|------|
| **Full node** | Provincial governing body | 3 (test) / 11 (prod) | Docker containers — hold ledger, endorse |
| **Lite node** | Malpots, buyers, sellers, officials | Unlimited (77 malpots) | Browser / SDK — submit, query, no ledger |
| **Orderer** | RAFT ordering service | 1 (dev) | Docker container |
| **Backend** | Go REST API gateway | 1 | Host process — connects to peers via gRPC |
| **Frontend** | Next.js dashboard | 1 | Browser — proxies API calls to backend |

**Land states**: `active` → `mortgaged` → `disputed` → `split`. Mortgaged or disputed land **cannot** be transferred.

---

## Prerequisites

| Tool | Min | Check |
|------|-----|-------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| Go | 1.22+ | `go version` |
| curl | any | `curl --version` |

> No Fabric binaries needed — everything runs inside Docker.

---

## Quick Start

```bash
# First time: full build (tear down, generate crypto, deploy chaincode, seed)
./scripts/rebuild.sh

# Fast reload: ~4s restart without rebuilding Fabric
./scripts/quickstart.sh           # backend only
./scripts/quickstart.sh -f        # backend + frontend
```

Open **http://localhost:3000** — live land registry dashboard.

Network endpoints:
- Go backend: **http://localhost:8080** (health: `/health`)
- `orderer.example.com:7050`
- `peer0.province1.example.com:7051`
- `peer0.province2.example.com:8051`
- `peer0.province3.example.com:9051`

---

## Project Layout

```
ndhack/
├── backend/                        # ★ Go backend (Fabric Gateway SDK + chaincode)
│   ├── main.go                     # HTTP server (Gin, :8080)
│   ├── go.mod / go.sum             # Module: github.com/ndhack/backend
│   ├── server                      # Compiled binary
│   ├── config/
│   │   └── config.go               # Environment-based configuration
│   ├── fabric/
│   │   ├── client.go               # Gateway client pool (gRPC)
│   │   └── identity.go             # X.509 identity loader (from MSP dirs)
│   ├── handlers/
│   │   └── land.go                 # All 13 REST API endpoints
│   ├── models/
│   │   └── models.go               # Request/response DTOs
│   └── chaincode/go/landreg/       # Smart contract (fabric-contract-api-go)
│       ├── landreg.go              # 12 chaincode functions
│       └── go.mod / go.sum
│
├── network/
│   ├── docker-compose.yaml         # orderer + 3 provincial peers + CLI
│   ├── crypto-config.yaml          # org topology → generates MSP certs
│   ├── configtx.yaml               # channel, genesis, consortium (auto-generated)
│   ├── core.yaml                   # peer config reference
│   └── orderer.yaml                # orderer config reference
│
├── frontend/                       # Next.js dashboard
│   ├── app/
│   │   ├── page.js                 # land registry UI
│   │   ├── layout.js
│   └── next.config.js              # proxy /api/* → :8080
│
├── application/                    # lite-node SDK client (unused — reference only)
│   └── src/                        # connect, enroll, register, invoke, query
│
├── scripts/
│   ├── rebuild.sh                  # ★ one-command full rebuild
│   └── stop.sh                     # tear down (Fabric + Go backend)
│
├── .gitignore
├── README.md
└── DETAILS.md
```

---

## Go Backend (Fabric Gateway SDK)

The backend replaces the old `docker exec cli peer chaincode` approach with native gRPC. Key improvements:

| Before | After |
|--------|-------|
| `child_process.execSync` blocks Node.js event loop | Go goroutines — concurrent, non-blocking |
| Shared CLI container identity | Per-user X.509 identity via `X-Identity` header |
| `docker exec` for every transaction | Direct gRPC to peer gateway service |
| No non-repudiation | Each user signs with their own private key |

### API Endpoints

```
GET  /health                          → {"status": "ok"}
GET  /api/land                        → GetAllLand()
GET  /api/land?id=PLOT-001            → QueryLand(PLOT-001)
GET  /api/land?owner=Ram              → GetLandByOwner(Ram)
GET  /api/land?status=disputed        → GetLandByStatus(disputed)
GET  /api/land?province=Province1     → GetLandByProvince(Province1)
GET  /api/land?parent=PLOT-001        → GetChildrenOf(PLOT-001)

POST /api/land  {"action":"register", "plotId":"...", "owner":"...", ...}
POST /api/land  {"action":"transfer", "plotId":"...", "buyer":"...", ...}
POST /api/land  {"action":"split", "plotId":"...", "children":[...], ...}
POST /api/land  {"action":"mortgage", "plotId":"...", "bank":"...", ...}
POST /api/land  {"action":"clear-mortgage", "plotId":"..."}
POST /api/land  {"action":"dispute", "plotId":"...", "caseNumber":"...", ...}
POST /api/land  {"action":"resolve-dispute", "plotId":"..."}
```

### Per-User Identity

Set the `X-Identity` header to sign as a specific user:

```bash
# Sign as province1 admin (default)
curl http://localhost:8080/api/land

# Sign as province2 malpot official
curl -H "X-Identity: province2/User1" http://localhost:8080/api/land

# Sign as province3 official
curl -X POST http://localhost:8080/api/land \
  -H "Content-Type: application/json" \
  -H "X-Identity: province3/User1" \
  -d '{"action":"register","plotId":"P-99","owner":"CitizenX","area":150}'
```

Identities are loaded from the cryptogen-generated MSP directories. In production, replace with Fabric CA for dynamic enrollment.

---

## Frontend Dashboard

Start: `cd frontend && npm run dev` → http://localhost:3000

| Feature | How |
|---------|-----|
| **Land table** | Auto-refreshes every 8s |
| **Register land** | Fill form → "Register Land" |
| **Transfer land** | Plot ID + buyer + price → "Transfer Land" |
| **Mortgage** | Plot ID + bank + amount + dates |
| **Dispute** | Plot ID + case number + court |
| **Status filter** | Tabs: All / Active / Mortgaged / Disputed |
| **Owner filter** | Search by owner name |
| **Detail panel** | Click any row → full land details |

The frontend calls the Go backend via Next.js proxy (`/api/*` → `:8080`). No `docker exec` required.

---

## Chaincode API (landreg)

| Function | Args |
|----------|------|
| `RegisterLand` | `plotId, surveyNumber, owner, location, province, area, landType` |
| `TransferLand` | `plotId, buyer, price` |
| `SplitLand` | `parentPlotId, childrenJSON` |
| `SetMortgage` | `plotId, bank, amount, startDate, endDate` |
| `ClearMortgage` | `plotId` |
| `FileDispute` | `plotId, caseNumber, court, description` |
| `ResolveDispute` | `plotId` |
| `QueryLand` | `plotId` |
| `GetLandByOwner` | `owner` |
| `GetLandByStatus` | `status` |
| `GetLandByProvince` | `province` |
| `GetChildrenOf` | `parentPlotId` |
| `GetAllLand` | _(none)_ |

**Endorsement**: `OutOf(3, Province1MSP.peer, Province2MSP.peer, Province3MSP.peer)` — all 3 provinces.

---

## Scaling to Production (11 full nodes)

Change `3` → `11` in these files:

| File | Change |
|------|--------|
| `network/crypto-config.yaml` | Add Province4–Province11 |
| `scripts/rebuild.sh` | `seq 1 3` → `seq 1 11` |
| `scripts/rebuild.sh` | `OutOf(3, ...)` → `OutOf(9, ...)` endorsement |

Endorsement: 9 of 11 = 75% approval threshold.

---

## Useful Commands

```bash
# Build & run Go backend standalone
cd backend && PROJECT_ROOT=$(pwd)/.. ./server

# Stop everything
./scripts/stop.sh --clean

# Logs
docker logs peer0.province1.example.com -f
docker logs orderer.example.com -f
cat backend/backend.log

# Admin shell
docker exec -it cli bash

# List committed chaincodes
docker exec cli peer lifecycle chaincode querycommitted -C mychannel

# Channel info
docker exec cli peer channel getinfo -c mychannel

# Backend health check
curl http://localhost:8080/health
```

---

## Production Notes

- **Fabric CA** — replace `cryptogen` with a real CA for dynamic identity management
- **RAFT cluster** — run 3–5 orderers for fault tolerance
- **CouchDB** — swap `goleveldb` → `CouchDB` for rich queries
- **Real TLS** — disable `InsecureSkipVerify` and configure proper hostname verification
- **Hardware** — 2 GB RAM per peer, 1 GB per orderer (minimum)

## License

Apache-2.0
