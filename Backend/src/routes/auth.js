// تسجيل الدخول
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: "Login and password are required" });
  }

  // 1) بندوّر على الشخص بالداتابيس
  const result = await db.query(
    "SELECT id, login, name, role, password_hash FROM users WHERE login = $1",
    [login]
  );
  const user = result.rows[0];

  // 2) بنقارن الباسورد مع النسخة المشفّرة
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    // نفس الرسالة بالحالتين عشان ما حدا يعرف إذا الاسم موجود
    return res.status(401).json({ error: "Wrong login or password" });
  }

  // 3) بنعمل token فيه id الشخص ودوره، وبيخلص بعد 8 ساعات
  const token = jwt.sign(
    { id: user.id, login: user.login, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    user: { id: user.id, login: user.login, name: user.name, role: user.role },
  });
});

// GET /api/auth/me  → "مين أنا؟"
router.get("/me", requireLogin, async (req, res) => {
  const result = await db.query(
    "SELECT id, login, name, role FROM users WHERE id = $1",
    [req.user.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;
