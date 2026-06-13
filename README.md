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
| **Full node** | Provincial governing body | 3 (test) / 11 (prod) | Docker container |
| **Lite node** | Malpots, buyers, sellers, officials | Unlimited | Browser / SDK |
| **Orderer** | RAFT ordering service | 1 (dev) | Docker container |
| **Backend** | Go REST API gateway | 1 | Docker container |
| **Frontend** | Next.js dashboard | 1 | Docker container |

**Land states**: `active` → `mortgaged` → `disputed` → `split`. Mortgaged or disputed land **cannot** be transferred.

---

## Prerequisites

| Tool | Min | Check |
|------|-----|-------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |

> Everything — Go, Node, Fabric — runs inside Docker. No host dependencies.

---

## Quick Start

```bash
# First time: full build (generates crypto, deploys chaincode, seeds data)
./scripts/rebuild.sh

# Or start/stop from project root
docker compose up -d
docker compose down
```

Open **http://localhost:3000** — live land registry dashboard.

---

## Project Layout

```
ndhack/
├── docker-compose.yaml         # include: network/docker-compose.yaml
├── .env                         # COMPOSE_PROJECT_NAME=fabric
├── backend/                        # Go backend + chaincode
│   ├── Dockerfile                  # Builds Go server in alpine container
│   ├── main.go                     # HTTP server (Gin, :8080)
│   ├── go.mod / go.sum             # Module: github.com/ndhack/backend
│   ├── config/config.go            # Auto-detects Docker vs host mode
│   ├── fabric/
│   │   ├── client.go               # Gateway client pool (gRPC to peers)
│   │   └── identity.go             # X.509 identity loader (MSP directories)
│   ├── handlers/land.go            # All 13 REST API endpoints
│   ├── models/models.go            # Request/response DTOs
│   └── chaincode/go/landreg/       # Smart contract (fabric-contract-api-go)
│       ├── landreg.go              # 12 chaincode functions
│       └── go.mod / go.sum
│
├── network/
│   ├── docker-compose.yaml         # 7 services: orderer, 3 peers, CLI, backend, frontend
│   ├── crypto-config.yaml          # Org topology → generates MSP certs
│   ├── configtx.yaml               # Channel, genesis, consortium (committed)
│   ├── core.yaml                   # Peer config reference
│   └── orderer.yaml                # Orderer config reference
│
├── frontend/                       # Next.js dashboard
│   ├── Dockerfile                  # Builds Node.js dev server in container
│   ├── app/page.js                 # Land registry UI
│   ├── app/layout.js               # Root layout (dark theme)
│   ├── next.config.js              # Proxies /api/* → backend:8080
│   └── package.json                # next + react only
│
├── scripts/
│   ├── rebuild.sh                  # Full rebuild
│   ├── quickstart.sh               # docker compose up -d --build
│   └── stop.sh                     # docker compose down -v
│
├── .gitignore
├── README.md
└── DETAILS.md
```

---

## Go Backend (Fabric Gateway SDK)

The backend connects to Fabric peers via native gRPC — no `docker exec` CLI dependency.

| Before | After |
|--------|-------|
| `child_process.execSync` blocks Node.js | Go goroutines — concurrent, non-blocking |
| Shared CLI container identity | Per-user X.509 identity via `X-Identity` header |
| `docker exec` for every transaction | Direct gRPC to peer gateway service |
| Works on some machines, not others | Identical Docker environment everywhere |

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
POST /api/land  {"action":"split", "plotId":"...", "children":[...]}
POST /api/land  {"action":"mortgage", "plotId":"...", "bank":"...", ...}
POST /api/land  {"action":"clear-mortgage", "plotId":"..."}
POST /api/land  {"action":"dispute", "plotId":"...", "caseNumber":"...", ...}
POST /api/land  {"action":"resolve-dispute", "plotId":"..."}
```

### Per-User Identity

```bash
# Sign as province1 admin (default)
curl http://localhost:8080/api/land

# Sign as province2 malpot official
curl -H "X-Identity: province2/User1" http://localhost:8080/api/land
```

In production, replace cryptogen with Fabric CA for dynamic enrollment.

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

**Endorsement**: `OutOf(3, Province1MSP.peer, Province2MSP.peer, Province3MSP.peer)`.

---

## Scaling to Production (11 full nodes)

Change `3` → `11` in:

| File | Change |
|------|--------|
| `network/crypto-config.yaml` | Add Province4–Province11 |
| `scripts/rebuild.sh` | `seq 1 3` → `seq 1 11` |
| `network/configtx.yaml` | Edit `OutOf(3, ...)` → `OutOf(9, ...)` endorsement |

Endorsement: 9 of 11 = 75% approval.

---

## Useful Commands

```bash
# Start / stop
docker compose up -d
docker compose down

# Logs
docker compose logs -f backend
docker logs peer0.province1.example.com -f

# Admin shell
docker exec -it cli bash

# Chaincode info
docker exec cli peer lifecycle chaincode querycommitted -C mychannel

# Backend health
curl http://localhost:8080/health
```

---

## Production Notes

- **Fabric CA** — replace `cryptogen` with a real CA for dynamic identity management
- **RAFT cluster** — run 3–5 orderers for fault tolerance
- **CouchDB** — swap `goleveldb` → `CouchDB` for rich queries
- **TLS** — Docker DNS matches cert SANs, no skip needed
- **Hardware** — 2 GB RAM per peer, 1 GB per orderer (minimum)

## License

Apache-2.0
