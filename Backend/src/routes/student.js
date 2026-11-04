// كل إشي الطالب بيعمله
const express = require("express");
const db = require("../db");
const { requireLogin, requireStudent } = require("../middleware/auth");

const router = express.Router();

// كل رابط هون لازم يكون مسجّل دخول + طالب
const onlyStudents = [requireLogin, requireStudent];

// كم تقييم لازم يوصل الطالب قبل ما يشوف متوسطه (عشان ما يعرف مين قيّمه)
const MIN_RATINGS_TO_SHOW = 3;

// دالة مساعدة: بتجيب فترة التصويت المفتوحة هسا (أو null)
async function getOpenWindow() {
  const result = await db.query(
    `SELECT id, title, starts_at, ends_at, min_votes, max_votes
     FROM voting_windows
     WHERE is_active = true AND now() BETWEEN starts_at AND ends_at
     ORDER BY starts_at DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

// دالة مساعدة: بتسجّل كل محاولة تصويت (حتى المرفوضة) لكشف الغش
async function logAttempt(raterId, rateeId, windowId, result) {
  // إذا rateeId مش id صحيح، ما بنسجّل (عشان ما يوقع الكود)
  try {
    await db.query(
      `INSERT INTO vote_attempts (rater_id, ratee_id, window_id, result)
       VALUES ($1, $2, $3, $4)`,
      [raterId, rateeId, windowId, result]
    );
  } catch (e) {
    /* تجاهل */
  }
}

// GET /api/me/rating → متوسطي بس، بدون labels وبدون مين قيّمني
router.get("/me/rating", onlyStudents, async (req, res) => {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count, ROUND(AVG(stars)::numeric, 1)::float AS average
     FROM ratings
     WHERE ratee_id = $1 AND is_invalidated = false`,
    [req.user.id]
  );
  const { count, average } = result.rows[0];

  if (count < MIN_RATINGS_TO_SHOW) {
    return res.json({
      average: null,
      visible: false,
      message: `Your rating appears after ${MIN_RATINGS_TO_SHOW} ratings`,
    });
  }
  res.json({ average, visible: true });
});

// GET /api/me/votes → كم صوت استعملت وكم ضايل
router.get("/me/votes", onlyStudents, async (req, res) => {
  const window = await getOpenWindow();
  if (!window) {
    return res.json({ used: 0, min: 0, max: 0, remaining: 0 });
  }
  const result = await db.query(
    `SELECT COUNT(*)::int AS used FROM ratings WHERE rater_id = $1 AND window_id = $2`,
    [req.user.id, window.id]
  );
  const used = result.rows[0].used;
  res.json({
    used,
    min: window.min_votes,
    max: window.max_votes,
    remaining: Math.max(window.max_votes - used, 0),
  });
});

// GET /api/windows/current → وقت انتهاء التصويت (للتايمر)
router.get("/windows/current", onlyStudents, async (req, res) => {
  const window = await getOpenWindow();
  if (!window) {
    return res.json({ isOpen: false });
  }
  res.json({
    id: window.id,
    title: window.title,
    startsAt: window.starts_at,
    endsAt: window.ends_at,
    isOpen: true,
  });
});

// GET /api/students?q=hala → بحث عن طالب بالاسم أو الـ intra login (بدون نفسي)
// بدون q بيرجّع كل الطلاب (عشان أي صفحة قديمة بتستعمله تضل شغالة)
router.get("/students", onlyStudents, async (req, res) => {
  const window = await getOpenWindow();
  const q = String(req.query.q || "").trim();

  if (req.query.q !== undefined && q.length < 2) {
    return res.status(400).json({ error: "Type at least 2 characters to search" });
  }

  // بنهرّب % و _ عشان ما يشتغلوا كـ wildcards بالبحث
  const pattern = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";

  const result = await db.query(
    `SELECT u.id, u.login, u.name,
            EXISTS (
              SELECT 1 FROM ratings r
              WHERE r.rater_id = $1 AND r.ratee_id = u.id AND r.window_id = $2
            ) AS "alreadyRated"
     FROM users u
     WHERE u.role = 'STUDENT' AND u.id <> $1
       AND ($3 = '' OR u.login ILIKE $4 OR u.name ILIKE $4)
     ORDER BY
       (lower(u.login) = lower($3)) DESC,           -- الـ login مطابق بالضبط أول
       (u.login ILIKE $3 || '%') DESC,               -- بعدين اللي بيبلش فيه
       (u.name ILIKE $3 || '%') DESC,
       u.name
     LIMIT CASE WHEN $3 = '' THEN NULL ELSE 10 END`,
    [req.user.id, window ? window.id : null, q, pattern]
  );
  res.json(result.rows);
});

// GET /api/labels?stars=2 → الـ labels المسموحة لهاد العدد من النجوم
router.get("/labels", onlyStudents, async (req, res) => {
  const stars = Number(req.query.stars);
  if (![1, 2, 3].includes(stars)) {
    return res.status(400).json({ error: "stars must be 1, 2 or 3" });
  }
  const result = await db.query(
    `SELECT id, name, severity FROM labels
     WHERE is_active = true AND $1 = ANY(allowed_stars)
     ORDER BY severity, name`,
    [stars]
  );
  res.json(result.rows);
});

// POST /api/ratings → تقييم طالب
router.post("/ratings", onlyStudents, async (req, res) => {
  const raterId = req.user.id;
  const { rateeId, stars, labelIds, explanation } = req.body;

  // 1) في تصويت مفتوح؟
  const window = await getOpenWindow();
  if (!window) {
    await logAttempt(raterId, rateeId, null, "WINDOW_CLOSED");
    return res.status(400).json({ error: "Voting window is closed" });
  }

  // 2) النجوم صحيحة؟
  if (![1, 2, 3].includes(stars)) {
    return res.status(400).json({ error: "Stars must be 1, 2 or 3" });
  }

  // 3) مش عم يقيّم حاله؟
  if (rateeId === raterId) {
    return res.status(400).json({ error: "You cannot rate yourself" });
  }

  // 4) الطالب اللي بدّه يقيّمه موجود؟
  const ratee = await db.query(
    `SELECT id FROM users WHERE id::text = $1 AND role = 'STUDENT'`,
    [String(rateeId)]
  );
  if (ratee.rows.length === 0) {
    return res.status(400).json({ error: "Student not found" });
  }

  // 5) ضايل معه أصوات؟
  const usedResult = await db.query(
    `SELECT COUNT(*)::int AS used FROM ratings WHERE rater_id = $1 AND window_id = $2`,
    [raterId, window.id]
  );
  if (usedResult.rows[0].used >= window.max_votes) {
    await logAttempt(raterId, rateeId, window.id, "NO_VOTES_LEFT");
    return res.status(400).json({ error: "No votes left" });
  }

  // 6) قيّمه قبل بهاي الفترة؟
  const already = await db.query(
    `SELECT 1 FROM ratings WHERE rater_id = $1 AND ratee_id = $2 AND window_id = $3`,
    [raterId, rateeId, window.id]
  );
  if (already.rows.length > 0) {
    await logAttempt(raterId, rateeId, window.id, "ALREADY_RATED");
    return res.status(400).json({ error: "You already rated this student" });
  }

  // 7) الـ labels: لازم واحد على الأقل، وكلهم مسموحين لهاد العدد من النجوم
  if (!Array.isArray(labelIds) || labelIds.length === 0) {
    return res.status(400).json({ error: "Choose at least one label" });
  }
  const labels = await db.query(
    `SELECT id, severity, allowed_stars FROM labels
     WHERE id::text = ANY($1) AND is_active = true`,
    [labelIds.map(String)]
  );
  if (labels.rows.length !== labelIds.length) {
    return res.status(400).json({ error: "Some labels do not exist" });
  }
  if (labels.rows.some((l) => !l.allowed_stars.includes(stars))) {
    return res.status(400).json({ error: "Label not allowed for this star level" });
  }

  // 8) إذا في label خطيرة (SERIOUS)، لازم يكتب سبب
  const hasSerious = labels.rows.some((l) => l.severity === "SERIOUS");
  const text = (explanation || "").trim();
  if (hasSerious && text.length < 10) {
    return res.status(400).json({
      error: "Explanation is required for serious flags (at least 10 characters)",
    });
  }

  // 9) كل إشي تمام → بنخزّن التقييم والـ labels مع بعض (transaction)
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO ratings (rater_id, ratee_id, window_id, stars, explanation)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [raterId, rateeId, window.id, stars, text || null]
    );
    const ratingId = inserted.rows[0].id;
    for (const labelId of labelIds) {
      await client.query(
        `INSERT INTO rating_labels (rating_id, label_id) VALUES ($1, $2)`,
        [ratingId, labelId]
      );
    }
    await client.query("COMMIT");
    await logAttempt(raterId, rateeId, window.id, "OK");

    res.status(201).json({
      id: ratingId,
      remaining: window.max_votes - usedResult.rows[0].used - 1,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    // لو اثنين طلبات وصلوا بنفس اللحظة، الداتابيس بتمنع التكرار
    if (err.code === "23505") {
      return res.status(400).json({ error: "You already rated this student" });
    }
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
