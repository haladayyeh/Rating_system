require("./config");
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const db = require("./db");
const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/student");
const staffRoutes = require("./routes/staff");
const abuseRoutes = require("./routes/abuse");
const leaderboardRoutes = require("./routes/leaderboard");
const migrate = require("./migrate");
const {
  loginLimiter, ratingLimiter, apiLimiter, securityHeaders, checkSecrets,
} = require("./middleware/security");

// إذا الأسرار ناقصة أو ضعيفة، السيرفر ما بيشتغل أصلاً
checkSecrets();

const app = express();
app.disable("x-powered-by");   // ما نحكي لأي حدا إنه السيرفر Express
app.set("trust proxy", 1);     // على Render: عشان نعرف الـ IP الحقيقي للمستخدم

// CORS: إذا حطينا CORS_ORIGIN بالـ .env (مثلاً رابط الفرونت)، بس هو بيقدر يحكي مع الـ API
const allowed = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(allowed.length ? { origin: allowed } : {}));

app.use(securityHeaders);
app.use(express.json({ limit: "10kb" })); // ما نقبل طلبات ضخمة

// حدود عدد الطلبات
app.use("/api", apiLimiter);
app.use("/api/auth/login", loginLimiter);
app.post("/api/ratings", ratingLimiter);

// الفرونت اند (React): بعد "npm run build" بنخدّم الملفات من Frontend/dist
// إذا لسا ما انبنى، بنرجع للصفحة التجريبية القديمة بـ public
const frontendDist = path.join(__dirname, "..", "..", "Frontend", "dist");
const hasFrontend = fs.existsSync(path.join(frontendDist, "index.html"));
app.use(express.static(hasFrontend ? frontendDist : path.join(__dirname, "..", "public")));

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

// روابط كشف الغش: /api/staff/abuse/... (لازم تكون قبل روابط الستاف)
app.use("/api/staff/abuse", abuseRoutes);

// روابط الستاف: /api/staff/...
app.use("/api/staff", staffRoutes);

// لوحة Top students: /api/staff/leaderboard و /api/leaderboard
app.use("/api", leaderboardRoutes);

// روابط الطالب: /api/me/rating و /api/ratings ...
app.use("/api", studentRoutes);

// أي رابط /api مش موجود → 404 JSON (مش صفحة HTML)
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// روابط الفرونت (زي /rate أو /staff/abuse): React Router هو اللي بيتعامل معها
if (hasFrontend) {
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// لو صار أي خطأ مش متوقع، بنرجّع رسالة بدل ما السيرفر يوقع
app.use((err, req, res, next) => {
  // JSON غلط أو طلب ضخم: هاد غلط من الطلب، مش من السيرفر
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request is too large" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 3000;

// أول إشي بنحدّث الداتابيس (لو في أعمدة جديدة)، وبعدين بنشغّل السيرفر
migrate()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already used by another program.`);
        console.error("   Set a free port in the project's .env, e.g.  PORT=3001");
      } else {
        console.error("❌ Server failed to start:", err.message);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("❌ Database update failed:", err.message);
    if (err.code === "ECONNREFUSED") {
      console.error("   Is the database running? Start it with: docker compose up -d db");
    } else if (err.code === "28P01") {
      console.error("   Wrong database password. POSTGRES_PASSWORD must match the one the database was created with.");
    }
    process.exit(1);
  });
