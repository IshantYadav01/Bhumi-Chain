# Bhumi-Chain— Private Blockchain System

A **Hyperledger Fabric v2.5** land registry on a private blockchain. Citizens buy, sell, and transfer land with full on-chain audit trail. All transactions are verified by a 3-peer endorsement network and permanently recorded on the ledger.

## Architecture

```
                    Ordering Service (RAFT)
                  orderer.landreg.com:7050
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
       peer0               peer1              peer2        ← 3 endorsing peers
       :7051               :8051              :9051
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Go Backend     │   ← Fabric Gateway SDK (gRPC)
                    │  localhost:8080 │   ← JWT auth + SQLite
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Next.js UI     │
                    │  localhost:3000 │
                    └─────────────────┘
```

| Layer | What | Count |
|-------|------|-------|
| **Orderer** | RAFT ordering service | 1 |
| **Peers** | Endorsing nodes (LandregMSP) | 3 |
| **Backend** | Go REST API + Fabric Gateway | 1 |
| **Frontend** | Next.js dashboard | 1 |
| **Chaincode** | Smart contract (Go) | 1 |

**Endorsement**: `OutOf(2, LandregMSP.peer)` — any 2 of 3 peers must endorse every transaction.

**Land workflow**: `registered → listed → offer accepted → buyer confirms → admin approves → ownership transferred`

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
# Full rebuild (pulls images, generates crypto, deploys chaincode, seeds data)
./scripts/rebuild.sh

# Or just start/stop
docker compose up -d --build
docker compose down -v
```

Open **http://localhost:3000** — live land registry dashboard.

---

## Users & Roles

| User | Password | Role | Capabilities |
|------|----------|------|-------------|
| `superadmin` | `super123` | superadmin | Everything + full block explorer |
| `admin` | `admin123` | admin | Register land, approve transactions, block explorer |
| `NID-001` | `pass123` | customer | Buy, sell, make offers |
| `NID-002` | `pass123` | customer | Buy, sell, make offers |
| `NID-003` | `pass123` | customer | Buy, sell, make offers |
| `NID-004` | `pass123` | customer | Buy, sell, make offers |
| `NID-005` | `pass123` | customer | Buy, sell, make offers |
| `NID-006` | `pass123` | customer | Buy, sell, make offers |

---

## Project Layout

```
├── docker-compose.yaml
├── backend/
│   ├── Dockerfile
│   ├── main.go                     # Gin server, JWT middleware, routes
│   ├── config/config.go            # Docker vs host auto-detect
│   ├── auth/auth.go                # SQLite user store, JWT sign/verify
│   ├── fabric/
│   │   ├── client.go               # Gateway gRPC client pool
│   │   └── identity.go             # X.509 MSP identity loader
│   ├── handlers/land.go            # All REST handlers + block explorer
│   ├── models/models.go            # Request/response types
│   └── chaincode/go/landreg/
│       ├── landreg.go              # Smart contract (15 functions)
│       └── landreg_test.go         # Unit tests with mock stub
├── network/
│   ├── docker-compose.yaml         # 7 services
│   ├── crypto-config.yaml          # MSP topology
│   ├── configtx.yaml               # Channel + endorsement policy
│   ├── core.yaml                   # Peer config reference
│   └── orderer.yaml                # Orderer config reference
├── frontend/
│   ├── Dockerfile
│   ├── app/page.js                 # Single-page dashboard (use client)
│   ├── app/layout.js               # Root layout (dark theme)
│   ├── app/login/page.js           # Login page
│   ├── lib/auth.js                 # JWT helpers
│   └── package.json
└── scripts/
    ├── rebuild.sh                  # Full rebuild + seed
    ├── quickstart.sh               # docker compose up
    └── stop.sh                     # docker compose down
```

---

## API Endpoints

### GET /api/land

| Query param | Description |
|-------------|-------------|
| _(none)_ | Get all land records (admin only) |
| `?id=X` | Get single land by ID |
| `?action=my-lands` | Get caller's lands |
| `?action=listings` | Get active sale listings |
| `?action=my-offers` | Get caller's offers |
| `?action=my-transactions` | Get caller's transactions |
| `?action=pending-transactions` | Get pending admin transactions (admin only) |
| `?action=explorer&blocks=N` | Block explorer (admin/superadmin) |
| `?landId=X` | Get offers for a specific land (owner only) |

### POST /api/land

| action | Required fields |
|--------|----------------|
| `register` | `plotId`, `owner`, `location`, `area` |
| `list-for-sale` | `landId`, `price` |
| `cancel-listing` | `landId` |
| `make-offer` | `landId`, `offeredPrice` |
| `update-offer` | `landId`, `offeredPrice` |
| `accept-offer` | `offerId` |
| `confirm-transaction` | `txId` |
| `reject-transaction` | `txId` |
| `admin-approve` | `txId` |

### Auth

| Method | Path | Body |
|--------|------|------|
| POST | `/api/login` | `{ nid, password }` |
| POST | `/api/signup` | `{ nid, password, name, role }` |

All `/api/*` endpoints require `Authorization: Bearer <token>` except `/health`, `/api/login`, `/api/signup`.

---

## Chaincode

| Function | Type | Description |
|----------|------|-------------|
| `RegisterLand` | Admin | Register a new land plot |
| `AdminApproveTransaction` | Admin | Finalize a land transfer |
| `ListForSale` | Customer | List land for sale at a price |
| `CancelListing` | Customer | Cancel an active listing |
| `MakeOffer` | Customer | Place a bid on a listed land |
| `UpdateOffer` | Customer | Change an existing pending bid |
| `AcceptOffer` | Customer | Seller accepts a specific offer |
| `ConfirmTransaction` | Customer | Buyer confirms after offer accepted |
| `RejectTransaction` | Customer | Either party rejects a transaction |
| `GetAllLand` | Query | Get all land records (admin) |
| `QueryLand` | Query | Get a single land record |
| `GetMyLands` | Query | Get lands owned by caller |
| `GetListings` | Query | Get active sale listings |
| `GetMyOffers` | Query | Get offers made by caller |
| `GetOffersForLand` | Query | Get all offers on a land (owner) |
| `GetPendingTransactions` | Query | Get transactions awaiting admin |
| `GetMyTransactions` | Query | Get caller's transactions |

---

## Port Map

| Service | Port | Container |
|---------|------|-----------|
| orderer | 7050 | orderer.landreg.com |
| peer0 | 7051 | peer0.landreg.com |
| peer1 | 8051 | peer1.landreg.com |
| peer2 | 9051 | peer2.landreg.com |
| Backend | 8080 | landreg-backend |
| Frontend | 3000 | landreg-frontend |

---

## Useful Commands

```bash
# Start / stop
docker compose up -d --build
docker compose down -v

# Logs
docker compose logs -f backend
docker logs peer0.landreg.com -f

# Admin shell
docker exec -it cli bash

# Backend health
curl http://localhost:8080/health

# Login
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"nid":"admin","password":"admin123"}'
```

---

## License

Apache-2.0
