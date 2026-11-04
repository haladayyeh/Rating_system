// الحماية العامة للسيرفر: حد لعدد الطلبات + headers أمان
// (مكتوبة بدون مكتبات خارجية)

// ---------- Rate limiter ----------
// بيعدّ الطلبات لكل "مفتاح" (مثلاً IP) خلال فترة، وإذا زادت عن الحد بيرجّع 429
function rateLimit({ windowMs, max, message, keyFn }) {
  const hits = new Map(); // key -> { count, resetAt }

  // كل دقيقة بنمسح المفاتيح اللي خلصت فترتها، عشان الذاكرة ما تكبر
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, 60 * 1000).unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;

    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(max - entry.count, 0));

    if (entry.count > max) {
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: message, retryAfterSeconds: retryAfter });
    }
    next();
  };
}

// 10 محاولات login كل 15 دقيقة لنفس الـ IP ونفس الاسم (يمنع تخمين الباسورد)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}:${String((req.body && req.body.login) || "").toLowerCase()}`,
});

// 20 تقييم بالدقيقة لنفس الشخص (يمنع السكربتات اللي بتبعت مئات التقييمات)
const ratingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "You are submitting ratings too fast. Please slow down.",
  keyFn: (req) => `${req.ip}:${(req.headers.authorization || "").slice(-24)}`,
});

// حد عام: 300 طلب بالدقيقة لكل IP على كل الـ API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: "Too many requests. Please slow down.",
});

// ---------- Security headers ----------
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");      // المتصفح ما يخمّن نوع الملف
  res.setHeader("X-Frame-Options", "DENY");                // ما حدا يحط الموقع جوا iframe
  res.setHeader("Referrer-Policy", "no-referrer");         // ما نبعت الرابط لمواقع ثانية
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");            // بيانات الـ API ما تنحفظ بالكاش
  }
  next();
}

// ---------- فحص الأسرار قبل ما يشتغل السيرفر ----------
function checkSecrets() {
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 16) {
    console.error(
      "❌ JWT_SECRET is missing or too short (needs at least 16 characters).\n" +
      "   Add a long random line to your .env file, for example:\n" +
      "   JWT_SECRET=" + require("crypto").randomBytes(32).toString("hex")
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is missing from your .env file.");
    process.exit(1);
  }
}

module.exports = { rateLimit, loginLimiter, ratingLimiter, apiLimiter, securityHeaders, checkSecrets };
