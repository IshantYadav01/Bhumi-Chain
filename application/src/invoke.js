/*
 * invoke.js — Submit transactions to the Fabric network (lite-node action).
 *
 * Usage:
 *   node src/invoke.js <username> <function> [args...]
 *
 * Examples:
 *   node src/invoke.js alice InitLedger
 *   node src/invoke.js alice CreateAsset asset99 Eve 999 purple 42
 *   node src/invoke.js alice TransferAsset asset1 Bob
 *   node src/invoke.js alice UpdateAsset asset1 orange 500 10
 *   node src/invoke.js alice DeleteAsset asset99
 */

"use strict";

const { Gateway } = require("fabric-network");
const { getWallet, getCCP } = require("./connect");

async function main() {
  const username = process.argv[2];
  const fcn = process.argv[3];

  if (!username || !fcn) {
    console.error(
      "Usage: node src/invoke.js <username> <function> [args...]"
    );
    process.exit(1);
  }

  // Collect remaining CLI args
  const rawArgs = process.argv.slice(4);
  const args = rawArgs.map((a) => {
    // Auto-convert integer-like strings so they match chaincode param types
    return /^-?\d+$/.test(a) ? a : a;
  });

  const wallet = await getWallet();
  const ccp = getCCP();

  // Check user identity
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
    `→ Submitting "${fcn}" with args [${args.join(", ")}] as "${username}"...`
  );

  // Build the submit call dynamically
  let result;
  if (fcn === "InitLedger") {
    result = await contract.submitTransaction("InitLedger");
  } else if (fcn === "CreateAsset") {
    if (args.length < 5) {
      console.error("CreateAsset needs: id owner value color size");
      process.exit(1);
    }
    result = await contract.submitTransaction("CreateAsset", ...args);
  } else if (fcn === "ReadAsset") {
    if (args.length < 1) {
      console.error("ReadAsset needs: id");
      process.exit(1);
    }
    result = await contract.evaluateTransaction("ReadAsset", ...args);
  } else if (fcn === "UpdateAsset") {
    if (args.length < 4) {
      console.error("UpdateAsset needs: id color value size");
      process.exit(1);
    }
    result = await contract.submitTransaction("UpdateAsset", ...args);
  } else if (fcn === "DeleteAsset") {
    if (args.length < 1) {
      console.error("DeleteAsset needs: id");
      process.exit(1);
    }
    result = await contract.submitTransaction("DeleteAsset", ...args);
  } else if (fcn === "TransferAsset") {
    if (args.length < 2) {
      console.error("TransferAsset needs: id newOwner");
      process.exit(1);
    }
    result = await contract.submitTransaction("TransferAsset", ...args);
  } else if (fcn === "GetAllAssets") {
    result = await contract.evaluateTransaction("GetAllAssets");
  } else {
    // Generic pass-through
    result = await contract.submitTransaction(fcn, ...args);
  }

  console.log("✔ Result:", result.toString());
  gateway.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✘ Transaction failed:", err.message);
    process.exit(1);
  });
