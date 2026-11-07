// تسجيل الدخول
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

// ---------- وضع الديمو: أي اسم جديد + 123456 = حساب طالب جديد ----------
// بيشتغل بس إذا DEMO_SIGNUP=true بالـ .env (أو بالـ docker-compose)
const DEMO_PASSWORD = "123456";
const DEMO_LOGIN = /^[a-z0-9][a-z0-9_-]{1,19}$/; // زي intra login: 2-20 حرف/رقم/-/_
const demoSignupOn = () => process.env.DEMO_SIGNUP === "true";

// حد لعدد الحسابات الجديدة من نفس الـ IP، عشان ما حدا يعبّي الداتابيس بسكربت
const SIGNUPS_PER_HOUR = 10;
const signups = new Map(); // ip -> { count, resetAt }
function signupAllowed(ip) {
  const now = Date.now();
  let entry = signups.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + 60 * 60 * 1000 };
    signups.set(ip, entry);
  }
  entry.count++;
  return entry.count <= SIGNUPS_PER_HOUR;
}

// "ali-shami" → "Ali Shami"
function nameFromLogin(login) {
  return login.split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const USER_COLUMNS = "id, login, name, role, nickname, nickname_icon, password_hash";

// GET /api/auth/demo → عشان صفحة الدخول تعرف إذا تعرض تلميح الديمو
router.get("/demo", (req, res) => {
  res.json({ signup: demoSignupOn(), password: demoSignupOn() ? DEMO_PASSWORD : undefined });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: "Login and password are required" });
  }

  // 1) بندوّر على الشخص بالداتابيس
  const result = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE login = $1`, [login]);
  let user = result.rows[0];

  // وضع الديمو: اسم مش موجود + الباسورد 123456 → بنعمل حساب طالب جديد
  if (!user && demoSignupOn() && password === DEMO_PASSWORD && typeof login === "string") {
    const clean = login.trim().toLowerCase();
    if (!DEMO_LOGIN.test(clean)) {
      return res.status(400).json({
        error: "New usernames must be 2-20 characters: letters, numbers, - or _",
      });
    }
    // ممكن يكون موجود بحروف صغيرة (مثلاً كتب "Dana" والحساب "dana")
    const existing = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE login = $1`, [clean]);
    user = existing.rows[0];
    if (!user) {
      if (!signupAllowed(req.ip)) {
        return res.status(429).json({ error: "Too many new accounts from this network. Try again later." });
      }
      const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
      // ON CONFLICT: لو اثنين سجّلوا نفس الاسم بنفس اللحظة
      const created = await db.query(
        `INSERT INTO users (login, name, password_hash, role) VALUES ($1, $2, $3, 'STUDENT')
         ON CONFLICT (login) DO NOTHING RETURNING ${USER_COLUMNS}`,
        [clean, nameFromLogin(clean), hash]
      );
      user = created.rows[0] || (await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE login = $1`, [clean])).rows[0];
      if (created.rows[0]) console.log(`Demo signup: new student "${clean}"`);
    }
  }

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
    user: {
      id: user.id, login: user.login, name: user.name, role: user.role,
      nickname: user.nickname, nicknameIcon: user.nickname_icon,
    },
  });
});

// GET /api/auth/me  → "مين أنا؟"
router.get("/me", requireLogin, async (req, res) => {
  const result = await db.query(
    `SELECT id, login, name, role, nickname, nickname_icon AS "nicknameIcon" FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;
