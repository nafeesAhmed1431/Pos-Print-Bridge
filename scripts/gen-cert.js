/**
 * Generates a free self-signed certificate for the print server's HTTPS listener.
 * Run: npm run gen-cert -- yourdomain.com  (defaults to localhost)
 * Then install certificates/server.crt as a trusted root certificate on every
 * till/tablet that will call this server over HTTPS.
 */
const fs = require("fs");
const path = require("path");
const selfsigned = require("selfsigned");

const commonName = process.argv[2] || "localhost";

const attrs = [{ name: "commonName", value: commonName }];
const pems = selfsigned.generate(attrs, {
  days: 3650,
  keySize: 2048,
  extensions: [
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: commonName }, // DNS
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" },
      ],
    },
  ],
});

const outDir = path.resolve(__dirname, "..", "certificates");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "server.key"), pems.private);
fs.writeFileSync(path.join(outDir, "server.crt"), pems.cert);

console.info(`Certificate generated for CN=${commonName}`);
console.info(`  ${path.join(outDir, "server.key")}`);
console.info(`  ${path.join(outDir, "server.crt")}`);
console.info("Install server.crt as a trusted root cert on every device that calls this server over HTTPS.");
