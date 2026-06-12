/*
 * enrollAdmin.js — Register the org admin identity with the CA.
 *
 * Run once per organisation before registering users.
 *   node src/enrollAdmin.js [Org1|Org2]
 */

"use strict";

const { getWallet, getCAClient } = require("./connect");

async function main() {
  const org = process.argv[2] || "Org1";
  const mspId = `${org}MSP`;
  const orgLower = org.toLowerCase();

  const wallet = await getWallet();
  const caClient = getCAClient(org);

  // Check if admin already enrolled
  const adminIdentity = await wallet.get("admin");
  if (adminIdentity) {
    console.log(`✔ Admin identity for ${org} already exists in wallet`);
    return;
  }

  // Enroll the admin
  const enrollment = await caClient.enroll({
    enrollmentID: "admin",
    enrollmentSecret: "adminpw",
  });

  const x509Identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes(),
    },
    mspId,
    type: "X.509",
  };

  await wallet.put("admin", x509Identity);
  console.log(`✔ Successfully enrolled admin for ${org} (MSP: ${mspId})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✘ Enrollment failed:", err.message);
    process.exit(1);
  });
