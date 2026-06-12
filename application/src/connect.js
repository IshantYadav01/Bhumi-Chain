/*
 * connect.js — Connection profile & gateway helper.
 *
 * Lite nodes use this to connect to ANY full node (peer) in the network.
 * You can spin up countless instances of this application — each is a lite node
 * that submits transactions and queries the ledger without maintaining a copy.
 */

"use strict";

const { Wallets } = require("fabric-network");
const FabricCAServices = require("fabric-ca-client");
const path = require("path");
const fs = require("fs");

// ── Connection profile ──────────────────────────────────────────────
// Points to all available full nodes (peers). Add more entries as you
// scale your peer count.
const ccp = {
  name: "ndhack-network",
  version: "1.0",
  client: {
    organization: "Org1",
    connection: {
      timeout: {
        peer: { endorser: "300" },
        orderer: "300",
      },
    },
  },
  organizations: {
    Org1: {
      mspid: "Org1MSP",
      peers: ["peer0.org1.example.com"],
      certificateAuthorities: ["ca.org1.example.com"],
    },
    Org2: {
      mspid: "Org2MSP",
      peers: ["peer0.org2.example.com"],
      certificateAuthorities: ["ca.org2.example.com"],
    },
  },
  peers: {
    "peer0.org1.example.com": {
      url: "grpcs://localhost:7051",
      tlsCACerts: {
        path: path.resolve(
          __dirname,
          "../../network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
        ),
      },
      grpcOptions: {
        "ssl-target-name-override": "peer0.org1.example.com",
        hostnameOverride: "peer0.org1.example.com",
      },
    },
    "peer0.org2.example.com": {
      url: "grpcs://localhost:9051",
      tlsCACerts: {
        path: path.resolve(
          __dirname,
          "../../network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
        ),
      },
      grpcOptions: {
        "ssl-target-name-override": "peer0.org2.example.com",
        hostnameOverride: "peer0.org2.example.com",
      },
    },
  },
  certificateAuthorities: {
    "ca.org1.example.com": {
      url: "https://localhost:7054",
      caName: "ca-org1",
      tlsCACerts: {
        path: path.resolve(
          __dirname,
          "../../network/organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem"
        ),
      },
      httpOptions: {
        verify: false,
      },
    },
  },
};

// ── Wallet path ─────────────────────────────────────────────────────
const walletPath = path.join(__dirname, "..", "wallets");

// ── Helpers ─────────────────────────────────────────────────────────

/** Build a file-system wallet. */
async function getWallet() {
  return await Wallets.newFileSystemWallet(walletPath);
}

/** Return the connection profile. */
function getCCP() {
  return ccp;
}

/** Return a CA client for the given org. */
function getCAClient(org = "Org1") {
  const caInfo =
    ccp.certificateAuthorities[`ca.${org.toLowerCase()}.example.com`];
  return new FabricCAServices(
    caInfo.url,
    { trustedRoots: fs.readFileSync(caInfo.tlsCACerts.path), verify: false },
    caInfo.caName
  );
}

module.exports = { getWallet, getCCP, getCAClient, walletPath, ccp };
