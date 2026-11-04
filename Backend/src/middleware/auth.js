// الحماية: بنفحص الـ token قبل ما نسمح لأي حدا يوصل للروابط
const jwt = require("jsonwebtoken");

// 1) لازم يكون مسجّل دخول
function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "You must be logged in" });
  }

  try {
    // بنفك الـ token وبنعرف مين الشخص ودوره
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next(); // كمّل للرابط
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// 2) لازم يكون ستاف
function requireStaff(req, res, next) {
  if (req.user.role !== "STAFF") {
    return res.status(403).json({ error: "Staff only" });
  }
  next();
}

// 3) لازم يكون طالب
function requireStudent(req, res, next) {
  if (req.user.role !== "STUDENT") {
    return res.status(403).json({ error: "Students only" });
  }
  next();
}

module.exports = { requireLogin, requireStaff, requireStudent };
