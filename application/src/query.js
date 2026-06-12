/*
 * query.js — Read-only queries against the ledger (lite-node action).
 *
 * Usage:
 *   node src/query.js <username> <function> [args...]
 *
 * Examples:
 *   node src/query.js alice ReadAsset asset1
 *   node src/query.js alice GetAllAssets
 *   node src/query.js alice AssetExists asset99
 */

"use strict";

const { Gateway } = require("fabric-network");
const { getWallet, getCCP } = require("./connect");

async function main() {
  const username = process.argv[2];
  const fcn = process.argv[3];
  const rawArgs = process.argv.slice(4);

  if (!username || !fcn) {
    console.error("Usage: node src/query.js <username> <function> [args...]");
    process.exit(1);
  }

  const wallet = await getWallet();
  const ccp = getCCP();

  const identity = await wallet.get(username);
  if (!identity) {
    console.error(
      `✘ Identity "${username}" not in wallet. Run 'node src/registerUser.js ${username}' first.`
    );
    process.exit(1);
  }

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: username,
    discovery: { enabled: true, asLocalhost: true },
  });

  const network = await gateway.getNetwork("mychannel");
  const contract = network.getContract("basic");

  console.log(
    `→ Querying "${fcn}" with args [${rawArgs.join(", ")}] as "${username}"...`
  );

  const result = await contract.evaluateTransaction(fcn, ...rawArgs);
  const parsed = JSON.parse(result.toString());

  console.log("✔ Result:");
  console.log(JSON.stringify(parsed, null, 2));

  gateway.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✘ Query failed:", err.message);
    process.exit(1);
  });
