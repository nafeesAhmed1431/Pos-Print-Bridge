const fs = require("fs");
const path = require("path");
const { readFile } = require("fs");

const { __basedir } = require("../consts");
const { errorHandler } = require("../errorHandler");
const { sendToUSB } = require("../transport/usb");
const { sendToNetwork } = require("../transport/network");

let config = {};
readFile(path.resolve(__basedir, "config.json"), (err, data) => {
  if (data) {
    try {
      config = JSON.parse(data.toString());
    } catch (e) {
      console.error("Invalid config.json:", e.message);
    }
  }
});

async function toFile(host, buffer) {
  const dir = path.resolve(__basedir, "runtime");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.resolve(dir, `${Date.now()} - ${host}.bin`);
  fs.writeFileSync(filePath, buffer);
}

async function printOneJob(job) {
  if (!job.content) throw new Error("Missing content");
  if (!job.encoding) throw new Error("Missing encoding");

  const buffer = Buffer.from(job.content, job.encoding.toLowerCase());

  job.host = (job.host || "USB").toString();

  const printerDef = config.printers && config.printers[job.host.toLowerCase()];
  if (typeof printerDef === "string") {
    job.host = printerDef;
    job.port = job.port || 9100;
    if (!job.transport) job.transport = "NETWORK";
  } else if (printerDef && typeof printerDef === "object") {
    job.host = printerDef.host;
    job.port = printerDef.port || job.port || 9100;
    if (!job.transport) job.transport = printerDef.transport || "NETWORK";
  }

  const hostUpper = job.host.toUpperCase();

  if (config.transport) {
    job.transport = config.transport;
  }
  if (!job.transport) {
    job.transport = hostUpper === "USB" ? "USB" : "NETWORK";
  }
  job.transport = job.transport.toUpperCase();

  switch (job.transport) {
    case "USB": {
      // job.host (or job.printerName) must be the Windows printer *share* name
      const shareName = job.printerName || job.host;
      await sendToUSB(shareName, buffer);
      break;
    }

    case "NETWORK": {
      const port = job.port || 9100;
      await sendToNetwork(job.host, port, buffer);
      break;
    }

    case "FILE": {
      await toFile(job.host, buffer);
      break;
    }

    default:
      throw new Error(`Unknown transport "${job.transport}"`);
  }
}

async function print(req, res) {
  if (!req.body) {
    return res.status(400).json({ message: "Body is missing" });
  }

  const jobs = req.body.jobs ? req.body.jobs : [req.body];
  const results = [];

  for (const job of jobs) {
    try {
      await printOneJob(job);
      results.push({ host: job.host, ok: true });
    } catch (err) {
      errorHandler(err, job);
      results.push({ host: job.host, ok: false, error: err.message });
    }
  }

  res.json({ message: "Processed", results });
}

function getJobs(req, res) {
  res.json([]);
}

module.exports = { print, getJobs };
