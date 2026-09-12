const path = require("path");
const winston = require("winston");
const { __basedir } = require("./consts");

const logger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.File({
      filename: path.resolve(__basedir, "logs/error.log"),
      handleExceptions: true,
    }),
  ],
});

function uncaughtErrorHandler(err, req, res, next) {
  logger.error(JSON.stringify(err));
  res.status(500).json({ error: err.message || "Unknown error" });
}

function errorHandler(err, job) {
  logger.error(JSON.stringify({ message: err.message, stack: err.stack, job }));
  console.error(`[print error] ${job ? job.host : "?"}:`, err.message);
}

module.exports = { uncaughtErrorHandler, errorHandler, logger };
