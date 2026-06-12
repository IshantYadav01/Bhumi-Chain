/*
 * quick-test.js — Fast lite-node test using cryptogen-generated admin identity.
 * Specifies endorsing peers explicitly to avoid discovery issues.
 */

"use strict";

const {
  Gateway,
  Wallets,
  DefaultEventHandlerStrategies,
} = require("fabric-network");
const path = require("path");
const fs = require("fs");

async function main() {
  const walletPath = path.join(__dirname, "..", "wallets");
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  // Load admin cert & key
  const mspDir = path.join(
    __dirname,
    "../../network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp",
  );
  const signcertsDir = path.join(mspDir, "signcerts");
  const keystoreDir = path.join(mspDir, "keystore");

  const certFile = fs.readdirSync(signcertsDir).find((f) => f.endsWith(".pem"));
  const keyFile = fs.readdirSync(keystoreDir).find((f) => f.endsWith("_sk"));

  await wallet.put("admin", {
    credentials: {
      certificate: fs
        .readFileSync(path.join(signcertsDir, certFile))
        .toString(),
      privateKey: fs.readFileSync(path.join(keystoreDir, keyFile)).toString(),
    },
    mspId: "Org1MSP",
    type: "X.509",
  });
  console.log("✔ Admin identity loaded\n");

  const org1Tls = fs
    .readFileSync(
      path.join(
        __dirname,
        "../../network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
      ),
    )
    .toString();
  const org2Tls = fs
    .readFileSync(
      path.join(
        __dirname,
        "../../network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt",
      ),
    )
    .toString();

  // ── Connect ────────────────────────────────────────────────
  const gateway = new Gateway();
  await gateway.connect(
    {
      name: "test-network",
      version: "1.0",
      client: { organization: "Org1" },
      organizations: {
        Org1: { mspid: "Org1MSP", peers: ["peer0.org1.example.com"] },
        Org2: { mspid: "Org2MSP", peers: ["peer0.org2.example.com"] },
      },
      peers: {
        "peer0.org1.example.com": {
          url: "grpcs://localhost:7051",
          tlsCACerts: { pem: org1Tls },
          grpcOptions: { "ssl-target-name-override": "peer0.org1.example.com" },
        },
        "peer0.org2.example.com": {
          url: "grpcs://localhost:9051",
          tlsCACerts: { pem: org2Tls },
          grpcOptions: { "ssl-target-name-override": "peer0.org2.example.com" },
        },
      },
      channels: {
        mychannel: {
          peers: {
            "peer0.org1.example.com": {
              endorsingPeer: true,
              chaincodeQuery: true,
              ledgerQuery: true,
              eventSource: true,
            },
            "peer0.org2.example.com": {
              endorsingPeer: true,
              chaincodeQuery: true,
              ledgerQuery: true,
              eventSource: true,
            },
          },
        },
      },
    },
    {
      wallet,
      identity: "admin",
      discovery: { enabled: false },
      eventHandlerOptions: {
        strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX,
      },
    },
  );

  const network = await gateway.getNetwork("mychannel");
  const contract = network.getContract("basic");

  // Query all assets
  console.log("→ GetAllAssets");
  const allAssets = JSON.parse(
    (await contract.evaluateTransaction("GetAllAssets")).toString(),
  );
  console.log(`✔ Found ${allAssets.length} assets:`);
  allAssets.forEach((a) =>
    console.log(
      `    ${a.id}: owner=${a.owner}, value=${a.value}, color=${a.color}`,
    ),
  );

  // Create asset
  console.log('\n→ CreateAsset("lite-1", "SDK", "777", "gold", "99")');
  await contract.submitTransaction(
    "CreateAsset",
    "lite-1",
    "SDK",
    "777",
    "gold",
    "99",
  );
  console.log("✔ Created");

  // Read
  const a1 = await contract.evaluateTransaction("ReadAsset", "lite-1");
  console.log("✔ ReadAsset:", a1.toString());

  // Transfer
  await contract.submitTransaction("TransferAsset", "lite-1", "NewOwner");
  const a2 = await contract.evaluateTransaction("ReadAsset", "lite-1");
  console.log("✔ After Transfer:", a2.toString());

  // Update
  await contract.submitTransaction(
    "UpdateAsset",
    "lite-1",
    "silver",
    "1000",
    "50",
  );
  const a3 = await contract.evaluateTransaction("ReadAsset", "lite-1");
  console.log("✔ After Update:", a3.toString());

  gateway.disconnect();
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Lite-node test PASSED!                 ║");
  console.log("╚══════════════════════════════════════════╝");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✘", err.message);
    process.exit(1);
  });
