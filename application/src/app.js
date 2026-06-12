/*
 * app.js — Multi-lite-node demo launcher.
 *
 * Spawns several lite-node clients that interact with the network concurrently,
 * demonstrating how countless lite nodes can share full-node infrastructure.
 *
 *   npm start
 */

"use strict";

const { Gateway } = require("fabric-network");
const { getWallet, getCCP } = require("./connect");

async function liteNode(username, action) {
  const wallet = await getWallet();
  const ccp = getCCP();

  const gateway = new Gateway();
  try {
    await gateway.connect(ccp, {
      wallet,
      identity: username,
      discovery: { enabled: true, asLocalhost: true },
    });

    const network = await gateway.getNetwork("mychannel");
    const contract = network.getContract("basic");

    console.log(`[${username}] → ${action.description}`);

    const result = await contract.evaluateTransaction(
      action.fcn,
      ...(action.args || [])
    );
    const payload = JSON.parse(result.toString());
    console.log(`[${username}] ✔`, JSON.stringify(payload, null, 2).slice(0, 200));
  } catch (err) {
    console.error(`[${username}] ✘`, err.message);
  } finally {
    gateway.disconnect();
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   NDHACK — Multi Lite-Node Demo              ║");
  console.log("║   Lite nodes query through full-node peers   ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Simulate multiple lite nodes querying concurrently
  const liteNodes = [
    { user: "alice", action: { fcn: "ReadAsset", args: ["asset1"], description: "Read asset1" } },
    { user: "alice", action: { fcn: "GetAllAssets", args: [], description: "Get all assets" } },
    { user: "alice", action: { fcn: "ReadAsset", args: ["asset2"], description: "Read asset2" } },
  ];

  await Promise.all(liteNodes.map((n) => liteNode(n.user, n.action)));

  console.log("\n✔ All lite-node queries complete.");
  console.log(
    "💡 To add more lite nodes: register users via 'npm run register' and run invoke/query scripts."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✘ Demo failed:", err.message);
    process.exit(1);
  });
