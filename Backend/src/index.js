require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// للتأكد إن السيرفر شغال
app.get("/hello", (req, res) => {
  res.json({ message: "السيرفر شغال!" });
});

// للتأكد إن السيرفر شايف الداتابيس
app.get("/api/health/db", async (req, res) => {
  try {
    const users = await db.query("SELECT COUNT(*) FROM users");
    const labels = await db.query("SELECT COUNT(*) FROM labels");
    res.json({
      database: "connected",
      users: Number(users.rows[0].count),
      labels: Number(labels.rows[0].count),
    });
  } catch (err) {
      res.status(500).json({ database: "error", code: err.code, error: err.message, details: String(err.errors || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
