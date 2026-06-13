# DETAILS.md — AI Agent Reference

> **Target audience**: AI coding agents, automated tooling.
> **Human readers**: See `README.md`.

---

## 1. Project Overview

Private Hyperledger Fabric v2.5 land registry — fully containerized:

- **3 provincial full nodes** (Province1–Province3) — test; scale to 11 for production
- **77 malpots, buyers, sellers, officials** as lite nodes (connect via frontend)
- **Go chaincode** `landreg` — 12 functions on-chain
- **Go backend** in Docker — Fabric Gateway SDK (gRPC), per-user X.509 signing
- **Next.js frontend** in Docker — proxies `/api/*` to backend container
- **`rebuild.sh`** — one-command full lifecycle (crypto → channel → chaincode → seed)
- **7 Docker services** — orderer, 3 peers, CLI, backend, frontend

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
| `crypto-config.yaml` | 3 province orgs (Province1–Province3), 1 peer each, 2 users each |
| `configtx.yaml` | Committed to git. 3 orgs, `OutOf(3, ...)` endorsement, RAFT consensus |
| `docker-compose.yaml` | 7 services: orderer + 3 peers + CLI + backend + frontend. Ports: 7051/8051/9051 |
| `core.yaml` | Reference peer config — **not actively used** |
| `orderer.yaml` | Reference orderer config — **not actively used** |

**Key compose patterns** (per peer `province${i}`):
- Peer port: `7051 + (i-1)*1000`, chaincode port: peer + 1
- MSP ID: `Province${i}MSP`
- Network: `fabric-net` (explicit `name:` to avoid prefix)
- CLI volume mount: `../backend/chaincode:/opt/gopath/.../peer/chaincode`

### 2.3 Go Backend (`backend/`)

| File | Role |
|------|------|
| `Dockerfile` | Multi-stage: `golang:1.22-alpine` builder → `alpine:3.20` runtime (12 MB) |
| `main.go` | HTTP server (Gin), routes, CORS, graceful shutdown |
| `config/config.go` | Auto-detects Docker (`/.dockerenv`) vs host. Docker mode: TLS verify ON, peer DNS |
| `fabric/client.go` | Gateway client pool — lazy per-identity connections, gRPC |
| `fabric/identity.go` | Loads X.509 identities from MSP dirs (handles `User1@org-cert.pem` and `cert.pem`) |
| `handlers/land.go` | All 13 REST API endpoints + `sendJSON` nil-guard |
| `models/models.go` | Request/response DTOs |
| `go.mod` | Module `github.com/ndhack/backend`, deps: `fabric-gateway v1.5.1`, `gin v1.10.0`, `grpc` |

**Identity pool**: Clients keyed by `"{org}/{user}"`. Created lazily, cached with `sync.RWMutex`. Default identity from env `FABRIC_ORG`/`FABRIC_USER`.

**Docker connection**: gRPC to `peer0.province1.example.com:7051` (Docker DNS = cert SAN). TLS verification ON — no skip needed. Endorsement via service discovery.

### 2.4 Chaincode (`backend/chaincode/go/landreg/`)

| File | Role |
|------|------|
| `landreg.go` | 12 functions using `fabric-contract-api-go/v2` |
| `go.mod` | Module `github.com/ndhack/landreg`, Go 1.22 |

**LandRecord struct**:
```go
type LandRecord struct {
    PlotID, SurveyNumber, Owner, PreviousOwner string
    Location, Province                          string
    Area                                        float64
    LandType                                    string
    Status         string  // "active", "mortgaged", "disputed", "split"
    ParentPlotID   string  `json:",omitempty"`
    Mortgage       *MortgageInfo
    Dispute        *DisputeInfo
    TransferCount  int
    LastTransfer   *TransferRecord
    RegisteredDate string
}
```

Query functions return `string` (raw JSON) to avoid schema validation rejecting `null` for optional pointer fields.

### 2.5 Frontend (`frontend/`)

| File | Role |
|------|------|
| `Dockerfile` | `node:18-alpine`, `BACKEND_URL=http://backend:8080` |
| `app/page.js` | "use client" — land table, forms, status tabs, owner filter, detail panel |
| `app/layout.js` | Root layout — dark theme |
| `next.config.js` | Rewrites `/api/*` → `${BACKEND_URL}/api/*` (Docker DNS: `backend:8080`) |
| `package.json` | `next`, `react`, `react-dom` only |

### 2.6 Scripts (`scripts/`)

| Script | Role |
|--------|------|
| `rebuild.sh` | Full lifecycle: tear down → chaincode deps → cryptogen → configtxgen → **docker compose build + up** → channel + anchors → chaincode install/approve/commit → seed via curl |
| `quickstart.sh` | `docker compose up -d --build` (10 lines) |
| `stop.sh` | `docker compose down -v --remove-orphans` (5 lines) |

**`rebuild.sh` key details**:
- Step 6: `docker compose build` + `docker compose up -d` — builds Go + Node images
- No host-based `go build` or `npm install` — everything in Docker
- Step 10: Probes backend with test transaction, retries up to 30s
- Step 10: Seeds 4 plots via `curl`, retries each up to 5 times
- `docker exec cli` only for admin: channel join, anchors, chaincode lifecycle

### 2.7 `.gitignore`

Ignores: `node_modules/`, `.next/`, `*.tar.gz`, `*.sum`, `vendor/`, `backend/server`, `backend/go.sum`, `backend/backend.log`, `organizations/`, `channel-artifacts/`, `*.log`, `.env`

---

## 3. File Dependency Graph

```
crypto-config.yaml ──► rebuild.sh ──► organizations/
                         │
configtx.yaml (git) ──► configtxgen ──► channel-artifacts/
                         │
docker-compose.yaml ──► docker compose build ──► backend + frontend images
docker-compose.yaml ──► docker compose up ──► 7 containers
                         │
landreg.go ──► peer chaincode install/approve/commit ──► chaincode live
                         │
backend container ◄── gRPC to peer0.province1.example.com:7051
       │
       └── handlers/land.go ◄── HTTP :8080
                         │
frontend container ◄── proxy /api/* → backend:8080
       │
       └── page.js ◄── fetch(/api/land)
```

---

## 4. Modification Patterns

### 4.1 Scale to 11 provinces

Change `3` → `11` in:
1. `network/crypto-config.yaml` — add Province4–Province11
2. `scripts/rebuild.sh` — `seq 1 3` → `seq 1 11`
3. `network/configtx.yaml` — `OutOf(3, ...)` → `OutOf(9, ...)`
4. Run `./scripts/rebuild.sh`

Backend connects to one gateway peer — no changes. Endorsement auto-collected.

### 4.2 Add a chaincode function

1. Add method to `SmartContract` in `backend/chaincode/go/landreg/landreg.go`
2. Add handler in `backend/handlers/land.go` (Evaluate for queries, Submit for invokes)
3. Add action case in `PostAction` switch
4. Add UI in `frontend/app/page.js`
5. Run `./scripts/rebuild.sh`

### 4.3 Add a field to LandRecord

1. Add to `LandRecord` struct in `landreg.go` with json tag
2. Update registration/transfer functions if needed
3. Update frontend forms
4. Run `./scripts/rebuild.sh`

### 4.4 Add new identity

1. Increase `Users: { Count: N }` in `network/crypto-config.yaml`
2. Run `./scripts/rebuild.sh` (regenerates MSP certs)
3. Use `X-Identity: province1/User3` header

---

## 5. Port Map

| Service | Host Port | Container |
|---------|-----------|-----------|
| orderer | 7050 | orderer.example.com |
| Province1 peer | 7051/7052 | peer0.province1.example.com |
| Province2 peer | 8051/8052 | peer0.province2.example.com |
| Province3 peer | 9051/9052 | peer0.province3.example.com |
| Backend | 8080 | landreg-backend |
| Frontend | 3000 | landreg-frontend |

---

## 6. API Reference (Go Backend)

### GET /api/land

| Query param | Chaincode function |
|-------------|--------------------|
| _(none)_ | `GetAllLand` |
| `?id=X` | `QueryLand(X)` |
| `?owner=X` | `GetLandByOwner(X)` |
| `?status=X` | `GetLandByStatus(X)` |
| `?province=X` | `GetLandByProvince(X)` |
| `?parent=X` | `GetChildrenOf(X)` |

### POST /api/land

Body: `{"action": "<action>", ...fields}`

| action | Required fields | Chaincode function |
|--------|----------------|--------------------|
| `register` | `plotId`, `owner` | `RegisterLand` |
| `transfer` | `plotId`, `buyer` | `TransferLand` |
| `split` | `plotId`, `children` | `SplitLand` |
| `mortgage` | `plotId`, `bank` | `SetMortgage` |
| `clear-mortgage` | `plotId` | `ClearMortgage` |
| `dispute` | `plotId`, `caseNumber` | `FileDispute` |
| `resolve-dispute` | `plotId` | `ResolveDispute` |

### Headers

| Header | Purpose |
|--------|---------|
| `X-Identity: org/user` | Sign as specific user (e.g. `province2/User1`) |
| _(none)_ | Default identity (`province1/Admin` in Docker) |

---

## 7. Known Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| `fabric-net` not found | Chaincode launch fails | `name: fabric-net` + `COMPOSE_PROJECT_NAME=fabric` |
| `etcdraft config missing` | Genesis fails | `EtcdRaft.Consenters` must be present in configtx |
| Schema validation | Query returns error | Query functions return `string` (raw JSON) |
| Literal `\n` in YAML | configtxgen parse error | Use `$'\n'` (ANSI-C quoting) |
| `go mod tidy` fails (chaincode) | Bad pseudo-version | Use `fabric-contract-api-go/v2 v2.0.0` |
| Gateway connection refused | Chaincode not committed yet | Wait for commit; rebuild retries seed up to 30s |
| `creator org unknown` | Crypto/channel mismatch | Run `./scripts/rebuild.sh` (full sync) |
| Empty API response (`[]`) | Seed failed silently | Rebuild now retries seed; manual: `curl -X POST :8080/api/land -d '{...}'` |

---

## 8. Generated / Git-Ignored

| Path | Created by | Contents |
|------|-----------|----------|
| `network/organizations/` | cryptogen | MSP certs, keys, TLS |
| `network/channel-artifacts/` | configtxgen | genesis.block, channel.tx, anchor .tx |
| `backend/go.sum` | `go mod tidy` | Dependency checksums |
| `frontend/.next/` | Next.js | Build output |
| `frontend/node_modules/` | npm | Dependencies |
