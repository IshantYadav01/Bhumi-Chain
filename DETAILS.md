# DETAILS.md — AI Agent Reference

> **Target audience**: AI coding agents, LLMs, automated tooling.  
> **Purpose**: Understand the project's full structure, every file's role, dependencies between files, and safe modification patterns.  
> **Human readers**: See `README.md`.

---

## 1. Project Overview

This is a **Hyperledger Fabric v2.5** network scaffold with:

- **2 peer organizations** (Org1, Org2), 1 peer each — the "full nodes" that hold the ledger
- **1 RAFT orderer** (dev mode; config supports 3–5)
- **Go chaincode** (`basic`) — asset CRUD with 8 functions
- **Node.js lite-node SDK client** (`application/`) — for programmatic Fabric SDK access
- **Next.js frontend** (`frontend/`) — web dashboard for human interaction
- **Shell scripts** (`scripts/`) — full lifecycle automation

All Fabric tooling (`cryptogen`, `configtxgen`, `peer`) runs inside Docker containers — no local binaries needed.

---

## 2. Complete File Manifest

### 2.1 Network Definition (`network/`)

| File | Role | Must edit when... |
|------|------|-------------------|
| `crypto-config.yaml` | Org/peer topology for `cryptogen`. Defines orderer org + peer orgs with peer count and user count. Output → `organizations/` | Adding a new org, changing peer count, adding users |
| `configtx.yaml` | Channel configuration for `configtxgen`. Defines MSPs, consortium, RAFT consenters, anchor peers, endorsement policies, capabilities. Output → `channel-artifacts/` | Adding orgs, changing consensus, modifying policies |
| `docker-compose.yaml` | Container orchestration. Defines 4 services: `orderer`, `peer0.org1`, `peer0.org2`, `cli`. Volumes mount `organizations/` and `channel-artifacts/`. Env vars set peer identity, TLS paths, gossip endpoints, gateway mode. | Adding/removing peers, changing ports, adding CouchDB |
| `core.yaml` | Reference peer configuration. **Not actively used** — peer settings are overridden by env vars in docker-compose. Exists for documentation. | Reference only |
| `orderer.yaml` | Reference orderer configuration. Same as above. | Reference only |

**Key env vars in docker-compose (per peer)**:
- `CORE_PEER_ID` — unique peer identifier
- `CORE_PEER_LOCALMSPID` — MSP ID (`Org1MSP`, `Org2MSP`)
- `CORE_PEER_ADDRESS` / `CORE_PEER_LISTENADDRESS` — gRPC endpoint + bind
- `CORE_PEER_GOSSIP_BOOTSTRAP` — initial gossip peer
- `CORE_PEER_GOSSIP_EXTERNALENDPOINT` — address other peers use to reach this one
- `CORE_PEER_TLS_*` — paths to TLS key/cert/CA
- `CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE` — must match the Compose network name (`fabric-net`)

**Critical detail**: The Compose network is explicitly named `fabric-net` (via `name: fabric-net`). This allows chaincode containers to join the network when launched by peers.

---

### 2.2 Chaincode (`chaincode/go/basic/`)

| File | Role |
|------|------|
| `basic.go` | Go smart contract using `fabric-contract-api-go/v2`. Implements `contractapi.Contract` with 8 public methods. Each method receives `contractapi.TransactionContextInterface`. |
| `go.mod` | Module `github.com/ndhack/basic`, Go 1.22, depends on `fabric-contract-api-go/v2 v2.0.0` |
| `go.sum` | Auto-generated dependency checksums |

**Chaincode structure**:
- `SmartContract` struct embeds `contractapi.Contract`
- All public methods become chaincode functions
- `InitLedger()` — writes 4 sample `Asset` structs to state
- `CreateAsset(id, owner, value int, color, size int)` — typed params, auto-converted from JSON strings by the contract API
- `ReadAsset(id) (*Asset, error)` — returns `*Asset`
- `UpdateAsset(id, color, value int, size int)`
- `DeleteAsset(id)`
- `TransferAsset(id, newOwner)`
- `GetAllAssets() ([]*Asset, error)` — range scan
- `AssetExists(id) (bool, error)`
- `main()` calls `contractapi.NewChaincode(&SmartContract{}).Start()`

**Asset struct** (the on-chain data model):
```go
type Asset struct {
    ID     string `json:"id"`
    Owner  string `json:"owner"`
    Value  int    `json:"value"`
    Color  string `json:"color"`
    Size   int    `json:"size"`
}
```

**To modify the chaincode**: Edit `basic.go`, then re-run `./scripts/deploy-cc.sh`. The script packages, installs on both peers, re-approves, and commits with an incremented sequence number. To add a new field to Asset, add it to the struct, update all methods that construct/update assets, and update the frontend forms.

**To add a new chaincode function**:
1. Add a public method to `SmartContract`
2. If it has parameters, use typed params (string, int, etc.) — the contract API auto-converts from JSON args
3. Re-deploy with `./scripts/deploy-cc.sh`
4. Add the function call to `frontend/lib/fabric.js` (in `cliInvoke` / `cliQuery`)
5. Add the UI form/button in `frontend/app/page.js`
6. If needed, add a new action case in `frontend/app/api/assets/route.js`

---

### 2.3 Lite-Node Application (`application/`)

| File | Role |
|------|------|
| `package.json` | Depends on `fabric-network` and `fabric-ca-client` (Fabric SDK v2) |
| `src/connect.js` | Connection profile (ccp) defining peers, TLS certs, CA endpoint. Exports `getWallet()`, `getCCP()`, `getCAClient()`. |
| `src/enrollAdmin.js` | Enrolls `admin` identity with Fabric CA. Run once per org. |
| `src/registerUser.js` | Registers + enrolls a named client user. Each lite node needs one. |
| `src/invoke.js` | CLI tool: `node src/invoke.js <username> <function> [args...]`. Submits transactions via the Fabric Gateway SDK. |
| `src/query.js` | CLI tool: `node src/query.js <username> <function> [args...]`. Evaluates (reads) from the ledger. |
| `src/app.js` | Multi-lite-node demo. Spawns concurrent queries from the same identity. |
| `src/quick-test.js` | Standalone integration test that loads admin certs directly from `organizations/` and tests query+invoke. |

**SDK connection flow**:
1. `enrollAdmin.js` → CA → wallet gets `admin` identity
2. `registerUser.js` → CA (as admin) → registers new user → wallet gets `<username>` identity
3. `invoke.js` / `query.js` → Gateway connects via ccp → uses wallet identity → calls chaincode

**Known limitation**: The Fabric SDK's `submitTransaction` (writes) requires service discovery to resolve the endorsement plan. Without a properly configured discovery service, writes may fail with "unable to find target committers". The `quick-test.js` works around this by disabling discovery and using the peer CLI for writes.

**The `quick-test.js` file** loads admin certs directly from the `organizations/` directory (bypassing CA enrollment) and tests both queries and transactions. This is the most reliable programmatic test for this project.

---

### 2.4 Frontend (`frontend/`)

| File | Role |
|------|------|
| `package.json` | Next.js 14 + React 18. `fabric-network` is installed but **not used at runtime** — see below. |
| `next.config.js` | Minimal Next.js config |
| `jsconfig.json` | Path alias `@/*` → project root |
| `lib/fabric.js` | **Core backend logic**. Uses `child_process.execSync` to run `docker exec cli peer chaincode ...` commands. Exports: `getAllAssets()`, `readAsset()`, `createAsset()`, `updateAsset()`, `deleteAsset()`, `transferAsset()`, `initLedger()`. |
| `app/layout.js` | Root layout — dark theme, system font |
| `app/page.js` | Main UI — "use client" component with asset table, forms, toasts. Polls `/api/assets` every 8s. |
| `app/api/assets/route.js` | Next.js API route handler. `GET` → `getAllAssets()`. `POST` → dispatches to create/update/delete/transfer/init based on `body.action`. |

**Why CLI, not SDK**: The Fabric SDK (`fabric-network`) has webpack bundling issues in Next.js (dynamic requires in `fabric-common`, `nconf`/`yargs` incompatibility). The CLI approach (shelling out to `docker exec cli peer chaincode ...`) is more reliable for a demo and avoids these issues. It also correctly handles multi-peer endorsement because the CLI command explicitly lists both peers.

**Frontend data flow**:
```
Browser (page.js) → fetch("/api/assets") → route.js → fabric.js → docker exec cli → peer → chaincode
```

**To add a new UI feature**:
1. Add the Fabric command to `lib/fabric.js`
2. Add the API handler case in `app/api/assets/route.js`
3. Add the form/button in `app/page.js`

**To change the polling interval**: Edit the `8000` value in `setInterval(fetchAssets, 8000)` in `page.js`.

---

### 2.5 Scripts (`scripts/`)

| Script | What it does | When to run |
|--------|-------------|-------------|
| `generate.sh` | Runs `cryptogen` (→ MSP certs in `organizations/`), then `configtxgen` (→ `genesis.block`, `channel.tx`, anchor peer updates in `channel-artifacts/`) | First time, or after changing `crypto-config.yaml` / `configtx.yaml` |
| `start.sh` | Runs `docker compose up -d`, creates channel, joins both peers, updates anchor peers | After `generate.sh` |
| `deploy-cc.sh` | Packages chaincode, installs on both peers, approves for both orgs, commits to channel | After `start.sh`, or after changing chaincode |
| `stop.sh` | Runs `docker compose down -v`. With `--clean` flag: also removes chaincode Docker images. | To tear down |

**Script execution order**: `generate.sh` → `start.sh` → `deploy-cc.sh` (then frontend / lite nodes)

**Idempotency notes**:
- `generate.sh` skips cryptogen if `organizations/` already exists. Delete it manually to force regeneration.
- `start.sh` always does `docker compose down` first, then `up -d`. Safe to re-run.
- `deploy-cc.sh` uses a fixed sequence number (1). To upgrade chaincode, increment `CC_SEQUENCE` in the script.

**Environment variables** (in `config/env.sh`):
- `NUM_ORGS=2` — number of peer orgs
- `NUM_PEERS_PER_ORG=1` — peers per org
- `CHANNEL_NAME=mychannel`
- `CHAINCODE_NAME=basic`
- `FABRIC_VERSION=2.5`

---

### 2.6 Config (`config/`)

| File | Role |
|------|------|
| `env.sh` | Central topology variables. Sources in scripts that need org/peer counts. Currently not auto-sourced by scripts — values are hardcoded. |

---

## 3. File Dependency Graph

```
crypto-config.yaml ──► generate.sh ──► organizations/
configtx.yaml      ──► generate.sh ──► channel-artifacts/
                                            │
docker-compose.yaml ──► start.sh ───────────┼──► Docker containers (orderer, peers, cli)
                                            │
basic.go + go.mod ────► deploy-cc.sh ───────┼──► chaincode installed on peers
                                            │
frontend/lib/fabric.js ◄── docker exec cli ─┘
frontend/app/api/assets/route.js ◄── fabric.js
frontend/app/page.js ◄── fetch(/api/assets)
```

---

## 4. Common Modification Patterns

### 4.1 Add a new peer org (Org3)

Files to edit (in order):
1. `network/crypto-config.yaml` — add `PeerOrgs` entry
2. `network/configtx.yaml` — add `&Org3` anchor (copy `&Org1`, adjust names/ports), add to `SampleConsortium` and `ChannelDemo.Organizations`
3. `network/docker-compose.yaml` — add peer service (copy `peer0.org1`, change name/ports/env vars)
4. `scripts/generate.sh` — add `configtxgen -asOrg Org3MSP` line for anchor peers
5. `scripts/start.sh` — add Org3 channel-join + anchor-peer-update commands
6. `scripts/deploy-cc.sh` — add Org3 install + approve blocks
7. `frontend/lib/fabric.js` — add Org3 peer addresses to `cliInvoke` command
8. Regenerate: `sudo rm -rf network/organizations network/channel-artifacts && ./scripts/generate.sh && ./scripts/start.sh && ./scripts/deploy-cc.sh`

### 4.2 Add a new chaincode function

1. Add method to `chaincode/go/basic/basic.go` → `SmartContract`
2. Run `cd chaincode/go/basic && go mod tidy && cd ../..` (update go.sum)
3. `./scripts/deploy-cc.sh` (re-deploy)
4. Add function to `frontend/lib/fabric.js` (in `cliQuery` or `cliInvoke` pattern)
5. Add API handler case in `frontend/app/api/assets/route.js`
6. Add UI in `frontend/app/page.js`

### 4.3 Add a new field to Asset

1. Add field to `Asset` struct in `basic.go`
2. Update `InitLedger()` — add field to sample assets
3. Update `CreateAsset()` — add field parameter
4. Update `UpdateAsset()` — add field update logic
5. `./scripts/deploy-cc.sh` (increment `CC_SEQUENCE` to 2)
6. Update `frontend/lib/fabric.js` — add field to `createAsset()` and `updateAsset()` calls
7. Update `frontend/app/page.js` — add form input for new field
8. Update `frontend/app/api/assets/route.js` — add field to request body parsing

### 4.4 Change endorsement policy

Edit `network/configtx.yaml` → `Application.Policies.Endorsement` rule. Current: `"MAJORITY Endorsement"`. Options:
- `"ANY Endorsement"` — any 1 org
- `"ALL Endorsement"` — all orgs
- `"OutOf(2, 'Org1MSP.peer', 'Org2MSP.peer')"` — specific count

Then regenerate channel artifacts and update the channel config (or restart fresh).

### 4.5 Switch to CouchDB

1. Add CouchDB service to `docker-compose.yaml`
2. Change peer env: `CORE_LEDGER_STATE_STATEDATABASE=CouchDB`
3. Add CouchDB connection env vars (`CORE_LEDGER_STATE_COUCHDBCONFIG_*`)
4. Restart network

---

## 5. Key Paths (Container-Internal)

Paths inside the `cli` container (used in scripts and `frontend/lib/fabric.js`):

| Purpose | Path |
|---------|------|
| Orderer TLS CA | `/opt/gopath/.../organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem` |
| Org1 peer TLS CA | `/opt/gopath/.../organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt` |
| Org2 peer TLS CA | `/opt/gopath/.../organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt` |
| Org1 admin MSP | `/opt/gopath/.../organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp` |
| Channel artifacts | `/opt/gopath/.../channel-artifacts/` |
| Chaincode source | `/opt/gopath/.../chaincode/go/basic/` |

These are Docker volume mounts defined in `docker-compose.yaml`.

---

## 6. Port Map

| Service | Host Port | Container Port | Protocol |
|---------|-----------|----------------|----------|
| orderer | 7050 | 7050 | gRPC |
| orderer | 7053 | 7053 | gRPC (admin) |
| peer0.org1 | 7051 | 7051 | gRPC (peer) |
| peer0.org1 | 7052 | 7052 | gRPC (chaincode) |
| peer0.org1 | 9443 | 9443 | gRPC (operations) |
| peer0.org2 | 9051 | 9051 | gRPC (peer) |
| peer0.org2 | 9052 | 9052 | gRPC (chaincode) |
| Next.js | 3001 | — | HTTP |

When adding new peers, use a consistent offset (e.g. Org3: 11051/11052, Org4: 13051/13052).

---

## 7. Docker Images Used

| Image | Purpose | Version |
|-------|---------|---------|
| `hyperledger/fabric-orderer` | Ordering node | 2.5 |
| `hyperledger/fabric-peer` | Peer node | 2.5 |
| `hyperledger/fabric-tools` | CLI (peer, cryptogen, configtxgen) | 2.5 |
| `hyperledger/fabric-ccenv` | Chaincode build environment (Go) | 2.5 |
| `hyperledger/fabric-baseos` | Chaincode runtime base image | 2.5 |

Chaincode containers are auto-built and named `dev-peer<id>-basic_1.0-<hash>`.

---

## 8. Known Issues & Workarounds

| Issue | Symptom | Fix |
|-------|---------|-----|
| `fabric-net` not found | Chaincode launch fails | Ensure `name: fabric-net` in docker-compose and `COMPOSE_PROJECT_NAME=fabric` |
| Permission denied on `organizations/` | Can't read MSP files | `sudo chown -R $(whoami):$(whoami) network/organizations` (files generated as root inside Docker) |
| SDK submit fails | "unable to find target committers" | Use CLI-based approach (`docker exec cli peer chaincode invoke`) or configure discovery properly |
| `go mod tidy` fails on chaincode | Version not found | Use `fabric-contract-api-go/v2 v2.0.0` with Go 1.22 |
| Chaincode install: "invalid UTF-8" | Go version mismatch with ccenv | Update `go.mod` to v2 contract API (matches ccenv's Go 1.26) |
| Genesis block: "etcdraft config missing" | Missing `EtcdRaft.Consenters` in configtx.yaml | Add `EtcdRaft.Consenters` block referencing orderer TLS certs |

---

## 9. Generated Directories (Git-Ignored)

| Path | Created by | Contents |
|------|-----------|----------|
| `network/organizations/` | `generate.sh` (cryptogen) | MSP certs, keys, TLS certs for all orgs/users |
| `network/channel-artifacts/` | `generate.sh` (configtxgen) | `genesis.block`, `channel.tx`, anchor peer `.tx` files |
| `frontend/.next/` | Next.js build | Compiled frontend |
| `application/node_modules/` | `npm install` | SDK dependencies |
| `frontend/node_modules/` | `npm install` | Frontend dependencies |
| `application/wallets/` | enrollAdmin/registerUser | User identity files |
