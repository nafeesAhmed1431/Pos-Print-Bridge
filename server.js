const fs = require("fs");
const http = require("http");
const https = require("https");

const createApp = require("./src/app");

const app = createApp();

const HTTP_PORT = process.env.HTTP_PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3002;

const httpServer = http.createServer(app).listen(HTTP_PORT, () => {
  console.info(`Print server running on : http://localhost:${HTTP_PORT}`);
});

const keyPath = "./certificates/server.key";
const certPath = "./certificates/server.crt";

let httpsServer;
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  httpsServer = https.createServer(options, app).listen(HTTPS_PORT, () => {
    console.info(`Print server running with SSL on : https://localhost:${HTTPS_PORT}`);
  });
} else {
  console.warn(
    "No certificate found in ./certificates - HTTPS server not started. Run 'npm run gen-cert' to create one."
  );
}

function shutdown() {
  console.info("shutting down");
  httpServer.close();
  if (httpsServer) httpsServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
