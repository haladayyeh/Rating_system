// شارة اللقب: أي مستخدم (طالب أو ستاف) بيحط لقب قصير + أيقونة جنب اسمه
const express = require("express");
const db = require("../db");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

// نفس أسماء الأيقونات اللي بـ Frontend/public/pixel : بس هدول مسموحين
const NICKNAME_ICONS = new Set([
  "key-silver", "key-gold", "pin", "crystal", "ruby", "plus", "check", "cross", "question",
  "exclamation", "skull", "bomb", "flame", "fire", "medal", "trophy", "gift", "crown", "coin",
  "clock", "shield", "helmet", "sword", "magic-sword", "arrow", "arrow-up", "arrow-down",
  "potion-red", "potion-yellow", "potion-blue", "potion-teal", "house", "envelope", "speech",
  "drop", "snail", "star-gold", "star-blue", "star-red", "star-teal", "heart", "heart-empty",
  "heart-half",
]);
const DEFAULT_ICON = "star-gold";
const MIN_LEN = 2;
const MAX_LEN = 20;
// حروف بأي لغة (عربي كمان) + أرقام + مسافات + شوية رموز بسيطة
const ALLOWED = /^[\p{L}\p{M}\p{N} _.\-!?'&+#]+$/u;

// بتنظّف اللقب وبترجع { value } أو { error }
function cleanNickname(raw) {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "string") return { error: "Nickname must be text" };
  const value = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (value === "") return { value: null }; // فاضي = شيل الشارة
  const length = [...value].length;
  if (length < MIN_LEN || length > MAX_LEN) {
    return { error: `Nickname must be ${MIN_LEN} to ${MAX_LEN} characters` };
  }
  if (!ALLOWED.test(value)) {
    return { error: "Nickname can only use letters, numbers, spaces and - _ . ! ? ' & + #" };
  }
  return { value };
}

// PATCH /api/me/nickname   body: { nickname: "Bug Hunter", icon: "sword" }
// nickname فاضي أو null → بيشيل الشارة
router.patch("/me/nickname", requireLogin, async (req, res) => {
  // الشارة للطلاب بس، الستاف ما إلهم شارات
  if (req.user.role !== "STUDENT") return res.status(403).json({ error: "Only students have name badges" });
  const { nickname, icon } = req.body || {};
  const cleaned = cleanNickname(nickname);
  if (cleaned.error) return res.status(400).json({ error: cleaned.error });

  if (icon !== undefined && icon !== null && !NICKNAME_ICONS.has(icon)) {
    return res.status(400).json({ error: "Unknown icon" });
  }
  const finalIcon = cleaned.value ? icon || DEFAULT_ICON : null;

  const r = await db.query(
    `UPDATE users SET nickname = $2, nickname_icon = $3 WHERE id = $1
     RETURNING nickname, nickname_icon AS "nicknameIcon"`,
    [req.user.id, cleaned.value, finalIcon]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: "User not found" });
  res.json(r.rows[0]);
});

module.exports = router;
