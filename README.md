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
                    │  Next.js UI     │
                    │  localhost:3000 │
                    └─────────────────┘
```

| Layer | Who | Count | Runs |
|-------|-----|-------|------|
| **Full node** | Provincial governing body | 3 (test) / 11 (prod) | Docker containers — hold ledger, endorse |
| **Lite node** | Malpots, buyers, sellers, officials | Unlimited (77 malpots) | Browser / SDK — submit, query, no ledger |
| **Orderer** | RAFT ordering service | 1 (dev) | Docker container |

**Land states**: `active` → `mortgaged` → `disputed` → `split`. Mortgaged or disputed land **cannot** be transferred.

---

## Prerequisites

| Tool | Min | Check |
|------|-----|-------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| Go | 1.21+ | `go version` |

> No Fabric binaries needed — everything runs inside Docker.

---

## Quick Start

```bash
# One command: tear down, generate crypto, start 3 peers, deploy chaincode, seed data
./scripts/rebuild.sh

# Start the dashboard
cd frontend && npm install && npm run dev
```

Open **http://localhost:3000** — live land registry dashboard.

Network endpoints:
- `orderer.example.com:7050`
- `peer0.province1.example.com:7051`
- `peer0.province2.example.com:8051`
- `peer0.province3.example.com:9051`

---

## Project Layout

```
ndhack/
├── network/
│   ├── docker-compose.yaml       # orderer + 3 provincial peers + CLI
│   ├── crypto-config.yaml        # org topology → generates MSP certs
│   ├── configtx.yaml             # channel, genesis, consortium (auto-generated)
│   ├── core.yaml                 # peer config reference
│   └── orderer.yaml              # orderer config reference
│
├── chaincode/go/landreg/
│   ├── landreg.go                # land registry smart contract
│   └── go.mod
│
├── frontend/                     # Next.js dashboard
│   ├── lib/fabric.js             # CLI-based Fabric backend
│   └── app/
│       ├── page.js               # land registry UI
│       ├── layout.js
│       └── api/land/route.js     # REST API (GET + POST)
│
├── application/                  # lite-node SDK client (unused — reference only)
│   └── src/                      # connect, enroll, register, invoke, query
│
├── scripts/
│   ├── rebuild.sh                # ★ one-command full rebuild
│   ├── generate.sh               # cryptogen + configtxgen
│   ├── start.sh                  # docker compose up + channel join
│   ├── deploy-cc.sh              # package → install → approve → commit
│   └── stop.sh                   # tear down
│
├── config/env.sh
├── .gitignore
├── README.md
└── DETAILS.md
```

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

The frontend talks to Fabric via `docker exec cli peer chaincode ...` — no SDK needed in the browser.

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

## CLI Reference

```bash
# Build peer args helper
ORDERER_CA="/opt/gopath/.../tlsca.example.com-cert.pem"
PA=""
for i in 1 2 3; do
    o="province${i}"; p=$((7051+(i-1)*1000))
    PA="${PA} --peerAddresses peer0.${o}.example.com:${p} --tlsRootCertFiles /opt/gopath/.../peerOrganizations/${o}.example.com/peers/peer0.${o}.example.com/tls/ca.crt"
done

# Query all land
docker exec cli peer chaincode query -C mychannel -n landreg -c '{"function":"GetAllLand","Args":[]}'

# Register
docker exec cli peer chaincode invoke -o orderer.example.com:7050 --tls --cafile ${ORDERER_CA} -C mychannel -n landreg ${PA} \
  -c '{"function":"RegisterLand","Args":["plot-001","SN-1001","Ram","Kathmandu","Province3","500.0","residential"]}'

# Transfer (Rs. 75 lakh)
docker exec cli peer chaincode invoke ... ${PA} \
  -c '{"function":"TransferLand","Args":["plot-001","Hari","7500000.0"]}'

# Mortgage
docker exec cli peer chaincode invoke ... ${PA} \
  -c '{"function":"SetMortgage","Args":["plot-002","Nepal Bank","2000000.0","2026-01-01","2031-01-01"]}'

# Dispute
docker exec cli peer chaincode invoke ... ${PA} \
  -c '{"function":"FileDispute","Args":["plot-001","CASE-001","Supreme Court","Boundary dispute"]}'

# Split land
docker exec cli peer chaincode invoke ... ${PA} \
  -c '{"function":"SplitLand","Args":["plot-001","[{\"plotId\":\"plot-001a\",\"owner\":\"Ram\",\"area\":200},{\"plotId\":\"plot-001b\",\"owner\":\"Hari\",\"area\":300}]"]}'

# Useful queries
docker exec cli peer channel getinfo -c mychannel
docker exec cli peer lifecycle chaincode querycommitted -C mychannel
docker logs peer0.province1.example.com -f
```

---

## Scaling to Production (11 full nodes)

Change `3` → `11` in these files:

| File | Line / variable |
|------|----------------|
| `network/crypto-config.yaml` | Add Province4–Province11 |
| `scripts/rebuild.sh` | `seq 1 3` → `seq 1 11` |
| `frontend/lib/fabric.js` | `i <= 3` → `i <= 11` |

Endorsement: change `OutOf(3, ...)` → `OutOf(9, ...)` for 75% approval.

---

## Useful Commands

```bash
# Logs
docker logs peer0.province1.example.com -f
docker logs orderer.example.com -f

# Admin shell
docker exec -it cli bash

# List committed chaincodes
docker exec cli peer lifecycle chaincode querycommitted -C mychannel

# Channel info
docker exec cli peer channel getinfo -c mychannel

# Tear down
./scripts/stop.sh --clean
```

---

## Production Notes

- **Fabric CA** — replace `cryptogen` with a real CA for dynamic identity management
- **RAFT cluster** — run 3–5 orderers for fault tolerance
- **CouchDB** — swap `goleveldb` → `CouchDB` for rich queries
- **Real TLS** — use enterprise PKI instead of `cryptogen` certs
- **Hardware** — 2 GB RAM per peer, 1 GB per orderer (minimum)

## License

Apache-2.0
