 require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("YAAN Backend Running");
});

app.use("/api/auth", authRoutes);

// Connect to PostgreSQL
sequelize.authenticate()
  .then(() => console.log("PostgreSQL connected"))
  .catch(err => console.log("DB error:", err.message));

// Sync database (create tables if they don't exist)
sequelize.sync()
  .then(() => console.log("Database synced"))
  .catch(err => console.log("Sync error:", err.message));

const PORT = process.env.PORT || 5000;
let srv;
if (require.main === module) {
  // bind to IPv4 localhost to avoid localhost/IPv6 resolution issues on Windows
  srv = app.listen(PORT, "127.0.0.1", () => {
    console.log(`YAAN Server running on port ${PORT}`);
    console.log("listening", srv.address());
    console.log('PID', process.pid);
  });

  srv.on("error", err => {
    console.error("Server error:", err);
  });
}

// global handlers to surface unexpected errors to logs
process.on('uncaughtException', err => {
  console.error('uncaughtException:', err);
});

process.on('unhandledRejection', (reason, p) => {
  console.error('unhandledRejection at:', p, 'reason:', reason);
});

module.exports = app;
