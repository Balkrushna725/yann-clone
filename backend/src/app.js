const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.Routes");

const app = express();

app.use(cors());
app.use(express.json());
// simple request logger for debugging connectivity
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

app.get("/", (req, res) => {
  res.send("YAAN Backend Running");
});

app.use("/api/auth", authRoutes);

module.exports = app;
