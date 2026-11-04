require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/student");
const staffRoutes = require("./routes/staff");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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

// روابط تسجيل الدخول: /api/auth/login و /api/auth/me
app.use("/api/auth", authRoutes);

// روابط الطالب: /api/me/rating و /api/ratings ...
app.use("/api", studentRoutes);
app.use("/api/staff", staffRoutes);
// لو صار أي خطأ مش متوقع، بنرجّع رسالة بدل ما السيرفر يوقع
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
