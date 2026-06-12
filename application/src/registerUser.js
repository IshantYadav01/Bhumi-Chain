/*
 * registerUser.js — Register a new lite-node user identity with the CA.
 *
 * This is how you create IDs for countless lite-node clients.
 * Each lite node runs with its own identity.
 *
 *   node src/registerUser.js <username> [Org1|Org2]
 *
 * Example:
 *   node src/registerUser.js alice Org1
 *   node src/registerUser.js bob   Org2
 */

"use strict";

const { getWallet, getCAClient } = require("./connect");

async function main() {
  const username = process.argv[2];
  const org = process.argv[3] || "Org1";

  if (!username) {
    console.error("Usage: node src/registerUser.js <username> [Org1|Org2]");
    process.exit(1);
  }

  const mspId = `${org}MSP`;
  const wallet = await getWallet();
  const caClient = getCAClient(org);

  // Must have admin enrolled first
  const adminIdentity = await wallet.get("admin");
  if (!adminIdentity) {
    console.error(
      `✘ Admin for ${org} not enrolled. Run 'node src/enrollAdmin.js ${org}' first.`
    );
    process.exit(1);
  }

  // Check if user already exists
  const userIdentity = await wallet.get(username);
  if (userIdentity) {
    console.log(`✔ Identity "${username}" already exists in wallet`);
    return;
  }

  // Register user with CA
  const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
  const adminUser = await provider.getUserContext(adminIdentity, "admin");

  const secret = await caClient.register(
    {
      affiliation: `${org.toLowerCase()}.department1`,
      enrollmentID: username,
      role: "client",
    },
    adminUser
  );

  // Enroll the new user
  const enrollment = await caClient.enroll({
    enrollmentID: username,
    enrollmentSecret: secret,
  });

  const x509Identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes(),
    },
    mspId,
    type: "X.509",
  };

  await wallet.put(username, x509Identity);
  console.log(
    `✔ Registered & enrolled lite-node user "${username}" for ${org} (MSP: ${mspId})`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✘ Registration failed:", err.message);
    process.exit(1);
  });
