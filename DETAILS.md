# DETAILS.md — AI Agent Reference

> **Target audience**: AI coding agents, automated tooling.
> **Human readers**: See `README.md`.

---

## 1. Project Overview

Private land registry on Hyperledger Fabric v2.5 — single organization, 3 peers, fully containerized:

- **1 org** (LandregMSP) — 3 peers, admin + customer users
- **Endorsement**: `OutOf(2, LandregMSP.peer)` — any 2 of 3 peers must endorse
- **Roles**: **Super Admin** (full block explorer), **Admin** (register land, approve), **Customer** (buy/sell/offer)
- **Identity pattern**: External customer identity passed as `caller` param; Fabric cert reserved for admin
- **Go chaincode** `landreg` — 16 functions on-chain
- **Go backend** — Fabric Gateway SDK (gRPC), per-identity signing via MSP certs
- **JWT auth** with **SQLite** user store (signup/login, 9 seeded users including superadmin)
- **7 Docker services** — orderer, 3 peers, CLI, backend, frontend
- **No on-chain RBAC** — trust via MSP cert OUs (admin vs client)

### Workflow

```
Admin registers land ──► Owner lists for sale (with price)
     Buyer makes/updates offer ──► Owner accepts offer
          Buyer confirms ──► Admin approves ──► Transfer executes
```

---

## 2. Complete File Manifest

### 2.1 Root (`./`)

| File | Role |
|------|------|
| `docker-compose.yaml` | `include: network/docker-compose.yaml` |
| `.env` | `COMPOSE_PROJECT_NAME=fabric` |

### 2.2 Network (`network/`)

| File | Role |
|------|------|
| `crypto-config.yaml` | 1 org (LandregMSP), 1 peer each on ports 7051/8051/9051, Admin + User1 identities |
| `configtx.yaml` | 1 org, `OutOf(2, LandregMSP.peer)` endorsement, RAFT consensus |
| `docker-compose.yaml` | 7 services: orderer + 3 peers + CLI + backend + frontend |

**Key compose patterns**:
- Peer ports: 7051, 8051, 9051; chaincode ports: 7052, 8052, 9052
- MSP ID: `LandregMSP`
- Network: `fabric-net` (explicit `name:`)

### 2.3 Go Backend (`backend/`)

| File | Role |
|------|------|
| `Dockerfile` | Multi-stage: `golang:1.22-alpine` → `alpine:3.20` (CGO_ENABLED=0) |
| `main.go` | Gin server, JWT middleware (`jwtMiddleware`), routes |
| `config/config.go` | Auto-detects Docker vs host mode |
| `fabric/client.go` | Gateway client pool — lazy per-identity connections, gRPC |
| `fabric/identity.go` | Loads X.509 identities from MSP directories |
| `auth/auth.go` | JWT auth with SQLite user store, signup, 9 seeded users |
| `handlers/land.go` | REST handlers for land + sale workflow + block explorer |
| `models/models.go` | `ActionRequest` + `APIResponse` DTOs |
| `go.mod` | Module `github.com/ndhack/backend` |

### 2.4 Chaincode (`backend/chaincode/go/landreg/`)

| File | Role |
|------|------|
| `landreg.go` | 16 functions using `fabric-contract-api-go/v2` |
| `landreg_test.go` | Unit tests with custom mock stub |
| `go.mod` | Module `github.com/ndhack/landreg`, Go 1.22 |

**Data types**: `LandRecord`, `TransferRecord`, `SaleListing`, `BuyerOffer`, `Transaction`

**Key prefixes**: `LISTING_`, `OFFER_`, `TX_` — used as world-state key prefixes

**Chaincode functions**:
- **Admin**: `RegisterLand`, `AdminApproveTransaction`
- **Customer**: `ListForSale`, `CancelListing`, `MakeOffer`, `UpdateOffer`, `AcceptOffer`, `ConfirmTransaction`, `RejectTransaction`
- **Queries**: `GetAllLand`, `QueryLand`, `GetMyLands`, `GetListings`, `GetMyOffers`, `GetOffersForLand`, `GetPendingTransactions`, `GetMyTransactions`

**Identity pattern**: Customer identity (`caller`) is passed as a function parameter from the backend (extracted from JWT `nid` claim). Fabric MSP identity (cert OU) is used only for admin checks via `isAdmin()`.

### 2.5 Auth Store (`auth/`)

SQLite database at `backend/data/landreg.db` (auto-created on startup).

**Seeded users** (all customer passwords: `pass123`):

| NID | Name | Role |
|-----|------|------|
| superadmin | Super Admin | superadmin |
| admin | System Admin | admin |
| NID-001 | Alice Sharma | customer |
| NID-002 | Bob Verma | customer |
| NID-003 | Carol Singh | customer |
| NID-004 | Dave Patel | customer |
| NID-005 | Eve Gupta | customer |
| NID-006 | Frank Das | customer |

### 2.6 Frontend (`frontend/`)

| File | Role |
|------|------|
| `Dockerfile` | `node:18-alpine`, `npm install`, `npm run dev` |
| `app/page.js` | "use client" — full dashboard: lands, listings, offers, transactions, admin, block explorer |
| `app/layout.js` | Root layout — dark theme, metadata |
| `app/login/page.js` | Login page with JWT auth |
| `lib/auth.js` | `getToken()`, `setToken()`, `authHeaders()`, `fetchWithAuth()` |
| `next.config.js` | Rewrites `/api/*` → backend |

### 2.7 Scripts (`scripts/`)

| Script | Role |
|--------|------|
| `rebuild.sh` | Full lifecycle: pull images → deps → teardown → crypto → network → chaincode → seed |
| `quickstart.sh` | `docker compose up -d --build` |
| `stop.sh` | `docker compose down -v --remove-orphans` |

---

## 3. API Reference (Go Backend)

### GET /api/land

| Query param | Chaincode function | Auth |
|-------------|--------------------|------|
| _(none)_ | `GetAllLand` | admin |
| `?id=X` | `QueryLand(X)` | any |
| `?action=my-lands` | `GetMyLands(caller)` | any |
| `?action=listings` | `GetListings` | any |
| `?action=my-offers` | `GetMyOffers(caller)` | any |
| `?action=my-transactions` | `GetMyTransactions(caller)` | any |
| `?action=pending-transactions` | `GetPendingTransactions` | admin |
| `?action=explorer&blocks=N` | Block explorer (QSCC) | admin |
| `?landId=X` | `GetOffersForLand(caller, X)` | owner |

### POST /api/land

| action | Required fields | Chaincode function |
|--------|----------------|--------------------|
| `register` | `plotId`, `owner`, `location`, `area` | `RegisterLand` |
| `list-for-sale` | `landId`, `price` | `ListForSale` |
| `cancel-listing` | `landId` | `CancelListing` |
| `make-offer` | `landId`, `offeredPrice` | `MakeOffer` |
| `update-offer` | `landId`, `offeredPrice` | `UpdateOffer` |
| `accept-offer` | `offerId` | `AcceptOffer` |
| `confirm-transaction` | `txId` | `ConfirmTransaction` |
| `reject-transaction` | `txId` | `RejectTransaction` |
| `admin-approve` | `txId` | `AdminApproveTransaction` |

### Auth endpoints

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/api/login` | `{ nid, password }` | Returns JWT + user info |
| POST | `/api/signup` | `{ nid, password, name, role }` | Create new user |

Auth via `Authorization: Bearer <token>` on all `/api/*` endpoints except `/health`, `/api/login`, `/api/signup`.

---

## 4. Port Map

| Service | Host Port | Container |
|---------|-----------|-----------|
| orderer | 7050 | orderer.landreg.com |
| peer0 | 7051/7052 | peer0.landreg.com |
| peer1 | 8051/8052 | peer1.landreg.com |
| peer2 | 9051/9052 | peer2.landreg.com |
| Backend | 8080 | landreg-backend |
| Frontend | 3000 | landreg-frontend |

---

## 5. Implementation Summary

### Network
- Single org (LandregMSP), 3 peers
- Endorsement: `OutOf(2, 'LandregMSP.peer')`
- RAFT ordering, TLS enabled, gateway enabled on all peers

### Chaincode
- Pass-through identity: customer NID from JWT → `caller` parameter
- Admin check: `isAdmin()` reads X.509 cert OU
- Key construction: `OFFER_{landId}_{buyer}`, `TX_{landId}`, `LISTING_{landId}`
- All state changes use `PutState` with JSON marshaling

### Backend
- SQLite auth store with signup/login
- 9 seeded users (1 superadmin, 1 admin, 6 customers)
- JWT middleware injects `msp_nid` and `msp_role` into Gin context
- Block explorer decodes chaincode invocation details (function, args, creator MSP, timestamp) from protobuf
- `BlockchainReceipt` type for standardized verification metadata

### Frontend
- Single-page "use client" Next.js app
- Role-based tab visibility: admin/superadmin see Admin + Block Explorer tabs
- Superadmin sees full block details (type, creator, chaincode, action, args, timestamp)
- Edit Bid feature for updating pending offers
- 8-second polling refresh
- Toast notifications for action results

### Recent Features Added
- **Multi-buyer bids**: Fixed duplicate-offer guard (was blocking all second offers)
- **Bid editing**: `UpdateOffer` chaincode function + frontend "Edit Bid" button
- **Superadmin**: Full block explorer with decoded transaction details
- **Rebuild script**: Pre-pulls all Fabric images, runs `npm install`, JWT-authenticated seed
