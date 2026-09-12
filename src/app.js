const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { __basedir } = require("./consts");
const { uncaughtErrorHandler } = require("./errorHandler");
const routes = require("./routes");

function createApp() {
  const app = express();

  fs.mkdirSync(path.resolve(__basedir, "logs"), { recursive: true });
  const accessLogStream = fs.createWriteStream(
    path.resolve(__basedir, "logs/access.log"),
    { flags: "a" }
  );

  app.use(cors());
  app.use(morgan("combined", { stream: accessLogStream }));
  app.use(bodyParser.json({ limit: "5mb" }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(helmet());

  routes(app);

  app.use(uncaughtErrorHandler);

  return app;
}

module.exports = createApp;
