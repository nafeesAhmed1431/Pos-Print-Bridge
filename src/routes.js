const printController = require("./controllers/printController");

module.exports = function routes(app) {
  app.get("/jobs", printController.getJobs);
  app.post("/print", printController.print);
};
