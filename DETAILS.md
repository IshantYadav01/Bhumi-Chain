# DETAILS.md — AI Agent Reference

> **Target audience**: AI coding agents, automated tooling.
> **Human readers**: See `README.md`.

---

## 1. Project Overview

Private land registry on Hyperledger Fabric v2.5 — 3 private organizations, fully containerized:

- **3 private orgs** (Org1–Org3) — each with 1 peer, admin + customer users
- **Endorsement**: `OutOf(2, ...)` — any 2 of 3 peers must endorse
- **Roles**: **Super Admin** (full block explorer + admin), **Admin** (register land, approve transactions) and **Customer** (buy/sell/make offers) — derived from X.509 cert OU
- **Go chaincode** `landreg` — 15 focused functions on-chain
- **Go backend** — Fabric Gateway SDK (gRPC), per-user X.509 signing
- **JWT auth** with **SQLite** user store (signup/login, 9 seeded dummy users including superadmin)
- **7 Docker services** — orderer, 3 peers, CLI, backend, frontend
- **No on-chain RBAC** — trust is via MSP cert OUs (admin vs client)

### Workflow

```
Admin registers land ──► Owner lists for sale (with price)
     Buyer makes offer ──► Owner accepts offer
          Buyer confirms ──► Admin approves ──► Transfer executes
```

---

## 2. Complete File Manifest

### 2.1 Root (`./`)

| File | Role |
|------|------|
| `docker-compose.yaml` | `include: network/docker-compose.yaml` — start from project root |
| `.env` | `COMPOSE_PROJECT_NAME=fabric` |

### 2.2 Network (`network/`)

| File | Role |
|------|------|
| `crypto-config.yaml` | 3 orgs (Org1–Org3), 1 peer each, admin + User1 each |
| `configtx.yaml` | 3 orgs, `OutOf(2, ...)` endorsement, RAFT consensus |
| `docker-compose.yaml` | 7 services: orderer + 3 peers + CLI + backend + frontend |

**Key compose patterns** (per peer `org${i}`):
- Peer port: `7051 + (i-1)*1000`, chaincode port: peer + 1
- MSP ID: `Org${i}MSP`
- Network: `fabric-net` (explicit `name:` to avoid prefix)

### 2.3 Go Backend (`backend/`)

| File | Role |
|------|------|
| `Dockerfile` | Multi-stage: `golang:1.22-alpine` → `alpine:3.20` (pure-Go SQLite, no CGO) |
| `main.go` | HTTP server (Gin), routes, JWT middleware, graceful shutdown |
| `config/config.go` | Auto-detects Docker vs host mode |
| `fabric/client.go` | Gateway client pool — lazy per-identity connections, gRPC |
| `fabric/identity.go` | Loads X.509 identities from MSP dirs |
| `auth/auth.go` | JWT auth with SQLite user store, signup, seed data |
| `handlers/land.go` | 9 REST handlers for land + sale workflow |
| `models/models.go` | ActionRequest + APIResponse DTOs |
| `go.mod` | Module `github.com/ndhack/backend`, deps: `fabric-gateway v1.5.1`, `gin v1.10.0`, `modernc.org/sqlite`, `jwt/v5` |

### 2.4 Chaincode (`backend/chaincode/go/landreg/`)

| File | Role |
|------|------|
| `landreg.go` | 15 functions using `fabric-contract-api-go/v2` |
| `go.mod` | Module `github.com/ndhack/landreg`, Go 1.22 |

**Data types**: `LandRecord`, `TransferRecord`, `SaleListing`, `BuyerOffer`, `Transaction`

**Chaincode functions**:
- **Admin**: `RegisterLand`, `AdminApproveTransaction`
- **Customer**: `ListForSale`, `CancelListing`, `MakeOffer`, `AcceptOffer`, `ConfirmTransaction`, `RejectTransaction`
- **Queries**: `GetAllLand`, `QueryLand`, `GetMyLands`, `GetListings`, `GetMyOffers`, `GetOffersForLand`, `GetPendingTransactions`, `GetMyTransactions`

### 2.5 Auth Store (`auth/`)

SQLite database at `backend/data/landreg.db` (auto-created on startup).

**Seeded users** (all passwords match usernames + "123": `admin123`, `alice123`, etc.):

| Username | Org | MSP User | Role |
|----------|-----|----------|------|
| admin | org1 | Admin | admin |
| alice | org1 | User1 | customer |
| bob | org1 | User1 | customer |
| carol | org2 | User1 | customer |
| dave | org2 | User1 | customer |
| eve | org3 | User1 | customer |
| frank | org3 | User1 | customer |

### 2.6 Frontend (`frontend/`)

| File | Role |
|------|------|
| `Dockerfile` | `node:18-alpine`, `BACKEND_URL=http://backend:8080` |
| `app/page.js` | "use client" — land table, forms, status tabs, owner filter, detail panel |
| `app/layout.js` | Root layout — dark theme |
| `next.config.js` | Rewrites `/api/*` → `${BACKEND_URL}/api/*` (Docker DNS: `backend:8080`) |
| `package.json` | `next`, `react`, `react-dom` only |

### 2.7 Scripts (`scripts/`)

| Script | Role |
|--------|------|
| `rebuild.sh` | Full lifecycle: tear down → chaincode deps → cryptogen → configtxgen → build + up → channel + anchors → chaincode install/approve/commit → seed |
| `quickstart.sh` | `docker compose up -d --build` |
| `stop.sh` | `docker compose down -v --remove-orphans` |

---

## 3. API Reference (Go Backend)

### GET /api/land

| Query param | Chaincode function |
|-------------|--------------------|
| _(none)_ | `GetAllLand` |
| `?id=X` | `QueryLand(X)` |
| `?action=my-lands` | `GetMyLands` |
| `?action=listings` | `GetListings` |
| `?action=my-offers` | `GetMyOffers` |
| `?action=my-transactions` | `GetMyTransactions` |
| `?action=pending-transactions` | `GetPendingTransactions` |
| `?landId=X` | `GetOffersForLand(X)` |

### POST /api/land

Body: `{"action": "<action>", ...fields}`

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
| POST | `/api/login` | `{ username, password }` | Returns JWT + user info |
| POST | `/api/signup` | `{ username, password, name, org, role }` | Create new user |

Auth is required via `Authorization: Bearer <token>` header on all `/api/*` endpoints except `/health`, `/api/login`, `/api/signup`.

---

## 4. Port Map

| Service | Host Port | Container |
|---------|-----------|-----------|
| orderer | 7050 | orderer.example.com |
| Org1 peer | 7051/7052 | peer0.org1.example.com |
| Org2 peer | 8051/8052 | peer0.org2.example.com |
| Org3 peer | 9051/9052 | peer0.org3.example.com |
| Backend | 8080 | landreg-backend |
| Frontend | 3000 | landreg-frontend |

---

## 5. Implementation Summary

### Network
- 3 orgs renamed from Province1-3 → Org1-3
- Endorsement policy: `OutOf(2, 'Org1MSP.peer', 'Org2MSP.peer', 'Org3MSP.peer')`
- All TLS, docker-compose, configtx references updated

### Chaincode
- Removed: on-chain RBAC (User records, RegisterUser, etc.), province, survey/malpot/official roles, mortgage, dispute, land split, multi-approval sale proposals
- Added: `SaleListing`, `BuyerOffer`, `Transaction` types with full sale workflow
- Auth via X.509 cert OU: `isAdmin()` checks for OU=admin
- 15 functions covering register, list, offer, accept, confirm, approve, reject + queries

### Backend
- SQLite auth store with signup/login
- 8 seeded dummy users across 3 orgs
- JWT-only auth (no X-Identity header)
- `/api/signup` endpoint for user registration
- Clean handlers mapped to new chaincode API

### Auth
- Removed: hardcoded credentials, X-Identity header fallback
- Added: `auth.InitDB()`, `auth.Signup()`, SQLite persistence
- Users table: id, username, password_hash, display_name, org, msp_user, role

### Stripped/Removed
- Government concepts (provinces, malpots, officials, surveyors)
- On-chain user management (RegisterUser, UpdateUserRoles, etc.)
- Mortgage, dispute, land split functionality
- Multi-party sale proposal workflow (approvals map)
- Province, SurveyNumber, LandType, ParentPlotID fields
- Legacy X-Identity header
- Hardcoded credential map
