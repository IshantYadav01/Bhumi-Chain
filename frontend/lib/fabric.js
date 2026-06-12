/**
 * fabric.js — Land Registry backend (CLI-based).
 * Chaincode: landreg  |  Channel: mychannel
 * Endorsement: all 3 provinces must endorse (test env).
 */

const { execSync } = require("child_process");

const ORDERER_CA =
  "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem";

function peerTls(org) {
  return `/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/${org}.example.com/peers/peer0.${org}.example.com/tls/ca.crt`;
}

function docker(args) {
  const cmd = ["docker", "exec", "cli", ...args]
    .map((a) => "'" + a.replace(/'/g, "'\\''") + "'")
    .join(" ");
  return execSync(cmd, { encoding: "utf-8", timeout: 30000 });
}

// ── Query ──────────────────────────────────────────────────────────
function cliQuery(fcn, ...args) {
  const ctor = JSON.stringify({ function: fcn, Args: args });
  const stdout = docker([
    "peer",
    "chaincode",
    "query",
    "-C",
    "mychannel",
    "-n",
    "landreg",
    "-c",
    ctor,
  ]);
  const t = stdout.trim();
  if (!t) return [];
  for (const line of t.split("\n")) {
    const s = line.trim();
    if ((s.startsWith("[") || s.startsWith("{")) && !s.includes("INFO"))
      return JSON.parse(s);
  }
  return [];
}

// ── Invoke (9-of-11 endorsement — target all 11 provinces) ─────────
function cliInvoke(fcn, ...args) {
  const ctor = JSON.stringify({ function: fcn, Args: args });
  const peerArgs = [];
  for (let i = 1; i <= 3; i++) {
    const org = "province" + i;
    const port = 7051 + (i - 1) * 1000;
    peerArgs.push("--peerAddresses", `peer0.${org}.example.com:${port}`);
    peerArgs.push("--tlsRootCertFiles", peerTls(org));
  }
  const stdout = docker([
    "peer",
    "chaincode",
    "invoke",
    "-o",
    "orderer.example.com:7050",
    "--tls",
    "--cafile",
    ORDERER_CA,
    "-C",
    "mychannel",
    "-n",
    "landreg",
    ...peerArgs,
    "-c",
    ctor,
  ]);
  return { success: true };
}

// ── Public API ─────────────────────────────────────────────────────
async function getAllLand() {
  return cliQuery("GetAllLand");
}
async function queryLand(id) {
  return cliQuery("QueryLand", id);
}
async function getLandByOwner(o) {
  return cliQuery("GetLandByOwner", o);
}
async function getLandByStatus(s) {
  return cliQuery("GetLandByStatus", s);
}
async function getLandByProvince(p) {
  return cliQuery("GetLandByProvince", p);
}
async function getChildrenOf(pid) {
  return cliQuery("GetChildrenOf", pid);
}

function registerLand(
  plotId,
  surveyNo,
  owner,
  location,
  province,
  area,
  landType,
) {
  return cliInvoke(
    "RegisterLand",
    plotId,
    surveyNo,
    owner,
    location,
    province,
    String(area),
    landType,
  );
}
function transferLand(plotId, buyer, price) {
  return cliInvoke("TransferLand", plotId, buyer, String(price));
}
function splitLand(parentPlotId, childrenJSON) {
  return cliInvoke("SplitLand", parentPlotId, childrenJSON);
}
function setMortgage(plotId, bank, amount, start, end) {
  return cliInvoke("SetMortgage", plotId, bank, String(amount), start, end);
}
function clearMortgage(plotId) {
  return cliInvoke("ClearMortgage", plotId);
}
function fileDispute(plotId, caseNo, court, desc) {
  return cliInvoke("FileDispute", plotId, caseNo, court, desc);
}
function resolveDispute(plotId) {
  return cliInvoke("ResolveDispute", plotId);
}

module.exports = {
  getAllLand,
  queryLand,
  getLandByOwner,
  getLandByStatus,
  getLandByProvince,
  getChildrenOf,
  registerLand,
  transferLand,
  splitLand,
  setMortgage,
  clearMortgage,
  fileDispute,
  resolveDispute,
};
