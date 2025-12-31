 require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./src/config/database");

const authRoutes = require("./src/routes/auth.Routes");

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost on any port for development
    if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
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

const PORT = process.env.PORT || 5001;
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
