// كل إشي الستاف بيشوفه وبيعمله
const express = require("express");
const db = require("../db");
const { requireLogin, requireStaff } = require("../middleware/auth");
const { runDetection } = require("../abuse/detectors");

const router = express.Router();

// كل رابط هون لازم يكون مسجّل دخول + ستاف
const onlyStaff = [requireLogin, requireStaff];

// دالة مساعدة: بتسجّل أي إشي بيعمله الستاف
async function audit(actorId, action, details) {
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, details) VALUES ($1, $2, $3)`,
    [actorId, action, details]
  );
}

// دالة مساعدة: الفترة اللي بنعرض إحصائياتها (المفتوحة، وإلا آخر وحدة)
async function getWindow(windowId) {
  if (windowId) {
    const r = await db.query(`SELECT * FROM voting_windows WHERE id::text = $1`, [windowId]);
    return r.rows[0] || null;
  }
  const r = await db.query(
    `SELECT * FROM voting_windows
     ORDER BY (is_active AND now() BETWEEN starts_at AND ends_at) DESC, starts_at DESC
     LIMIT 1`
  );
  return r.rows[0] || null;
}

// ============ الإحصائيات ============

// GET /api/staff/overview → الأرقام العامة
router.get("/overview", onlyStaff, async (req, res) => {
  const window = await getWindow(req.query.windowId);
  if (!window) return res.json({ window: null });
  await runDetection(window.id); // عشان عدد حالات الغش يكون محدّث

  const r = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM ratings WHERE window_id = $1 AND NOT is_invalidated) AS "totalRatings",
       (SELECT COUNT(*)::int FROM ratings WHERE window_id = $1 AND is_invalidated) AS "invalidatedRatings",
       (SELECT COUNT(*)::int FROM users WHERE role = 'STUDENT') AS "totalStudents",
       (SELECT COUNT(DISTINCT rater_id)::int FROM ratings WHERE window_id = $1) AS "studentsWhoRated",
       (SELECT COUNT(*)::int FROM users u WHERE u.role = 'STUDENT'
          AND (SELECT COUNT(*) FROM ratings WHERE rater_id = u.id AND window_id = $1) < $2) AS "studentsBelowMinimum",
       (SELECT COUNT(*)::int FROM abuse_cases WHERE status = 'OPEN') AS "openAbuseCases"`,
    [window.id, window.min_votes]
  );
  const stats = r.rows[0];
  res.json({
    window: {
      id: window.id, title: window.title,
      startsAt: window.starts_at, endsAt: window.ends_at,
      minVotes: window.min_votes, maxVotes: window.max_votes,
    },
    ...stats,
    studentsWhoDidNotRate: stats.totalStudents - stats.studentsWhoRated,
  });
});

// GET /api/staff/students?q=hala → كل الطلاب، أو بحث بالاسم أو الـ intra login
router.get("/students", onlyStaff, async (req, res) => {
  const q = String(req.query.q || "").trim();
  const pattern = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";

  const result = await db.query(`
    SELECT
      u.id,
      u.name,
      u.login,
      r.average,
      COALESCE(r.ratings_received, 0)::int AS "ratingsReceived",
      COALESCE(v.votes_given, 0)::int AS "votesGiven"
    FROM users u

    LEFT JOIN (
      SELECT
        ratee_id,
        ROUND(AVG(stars)::numeric, 1)::float AS average,
        COUNT(*)::int AS ratings_received
      FROM ratings
      WHERE is_invalidated = false
      GROUP BY ratee_id
    ) r ON r.ratee_id = u.id

    LEFT JOIN (
      SELECT
        rater_id,
        COUNT(*)::int AS votes_given
      FROM ratings
      GROUP BY rater_id
    ) v ON v.rater_id = u.id

    WHERE u.role = 'STUDENT'
      AND ($1 = '' OR u.login ILIKE $2 OR u.name ILIKE $2)
    ORDER BY
      (lower(u.login) = lower($1)) DESC,
      (u.login ILIKE $1 || '%') DESC,
      (u.name ILIKE $1 || '%') DESC,
      u.name
  `, [q, pattern]);

  res.json(result.rows);
});


// SQL مشترك: تقييم مع أسماء الطرفين والـ labels
const RATING_SELECT = `
  SELECT r.id AS "ratingId", r.stars, r.explanation, r.created_at AS "createdAt",
         r.is_invalidated AS invalidated, r.invalidated_reason AS "invalidatedReason",
         r.window_id AS "windowId",
         json_build_object('id', a.id, 'login', a.login, 'name', a.name) AS "from",
         json_build_object('id', b.id, 'login', b.login, 'name', b.name) AS "to",
         COALESCE(
           (SELECT json_agg(l.name ORDER BY l.name) FROM rating_labels rl
              JOIN labels l ON l.id = rl.label_id WHERE rl.rating_id = r.id),
           '[]') AS labels
  FROM ratings r
  JOIN users a ON a.id = r.rater_id
  JOIN users b ON b.id = r.ratee_id`;

// GET /api/staff/students/:id
router.get("/students/:id", onlyStaff, async (req, res) => {
  // First, make sure this student exists
  const studentResult = await db.query(
    `SELECT id, name, login
     FROM users
     WHERE id::text = $1 AND role = 'STUDENT'`,
    [req.params.id]
  );

  if (studentResult.rows.length === 0) {
    return res.status(404).json({ error: "Student not found" });
  }

  const student = studentResult.rows[0];

  // Ratings this student RECEIVED
  const received = await db.query(
    `SELECT
       r.id,
       r.stars,
       r.explanation,
       r.created_at,
       r.is_invalidated,
       r.invalidated_reason,
       u.name AS "raterName",
       u.login AS "raterLogin",
       COALESCE(
         json_agg(
           json_build_object(
             'name', l.name,
             'severity', l.severity
           )
         ) FILTER (WHERE l.id IS NOT NULL),
         '[]'
       ) AS labels
     FROM ratings r
     JOIN users u ON u.id = r.rater_id
     LEFT JOIN rating_labels rl ON rl.rating_id = r.id
     LEFT JOIN labels l ON l.id = rl.label_id
     WHERE r.ratee_id = $1
     GROUP BY r.id, u.id
     ORDER BY r.created_at DESC`,
    [student.id]
  );

  // Ratings this student GAVE
  const given = await db.query(
    `SELECT
       r.id,
       r.stars,
       r.explanation,
       r.created_at,
       r.is_invalidated,
       r.invalidated_reason,
       u.name AS "rateeName",
       u.login AS "rateeLogin",
       COALESCE(
         json_agg(
           json_build_object(
             'name', l.name,
             'severity', l.severity
           )
         ) FILTER (WHERE l.id IS NOT NULL),
         '[]'
       ) AS labels
     FROM ratings r
     JOIN users u ON u.id = r.ratee_id
     LEFT JOIN rating_labels rl ON rl.rating_id = r.id
     LEFT JOIN labels l ON l.id = rl.label_id
     WHERE r.rater_id = $1
     GROUP BY r.id, u.id
     ORDER BY r.created_at DESC`,
    [student.id]
  );

  // كم مرة أخذ كل label (من التقييمات اللي مش ملغية)
  const labelsReceived = await db.query(
    `SELECT l.name, l.severity, COUNT(*)::int AS count
     FROM ratings r
     JOIN rating_labels rl ON rl.rating_id = r.id
     JOIN labels l ON l.id = rl.label_id
     WHERE r.ratee_id = $1 AND NOT r.is_invalidated
     GROUP BY l.name, l.severity
     ORDER BY count DESC`,
    [student.id]
  );

  const avg = await db.query(
    `SELECT ROUND(AVG(stars)::numeric, 1)::float AS average
     FROM ratings WHERE ratee_id = $1 AND NOT is_invalidated`,
    [student.id]
  );

  res.json({
    student: { ...student, average: avg.rows[0].average },
    received: received.rows,
    given: given.rows,
    labelsReceived: labelsReceived.rows,
  });
});


// GET /api/staff/ratings?groupBy=label|stars|student&windowId=...
router.get("/ratings", onlyStaff, async (req, res) => {
  const { groupBy, windowId } = req.query;
  const where = windowId ? `WHERE r.window_id::text = $1` : "";
  const params = windowId ? [windowId] : [];
  const all = (await db.query(`${RATING_SELECT} ${where} ORDER BY r.created_at DESC`, params)).rows;

  if (!groupBy) return res.json(all);

  const groups = {};
  const add = (key, rating) => {
    if (!groups[key]) groups[key] = { group: key, count: 0, ratings: [] };
    groups[key].count++;
    groups[key].ratings.push(rating);
  };

  for (const rating of all) {
    if (groupBy === "stars") add(`${rating.stars} stars`, rating);
    else if (groupBy === "student") add(rating.to.login, rating);
    else if (groupBy === "label") rating.labels.forEach((l) => add(l, rating));
    else return res.status(400).json({ error: "groupBy must be label, stars or student" });
  }

  res.json(Object.values(groups).sort((a, b) => b.count - a.count));
});

// GET /api/staff/windows/:id/participation → مين صوّت ومين لأ، ومين ما وصل للحد الأدنى
router.get("/windows/:id/participation", onlyStaff, async (req, res) => {
  const w = await db.query(
    `SELECT id, min_votes, max_votes FROM voting_windows WHERE id::text = $1`,
    [req.params.id]
  );
  if (w.rows.length === 0) return res.status(404).json({ error: "Window not found" });
  const { min_votes: minVotes, max_votes: maxVotes } = w.rows[0];

  const r = await db.query(
    `SELECT u.id, u.login, u.name,
       (SELECT COUNT(*)::int FROM ratings WHERE rater_id = u.id AND window_id::text = $1) AS "votesGiven"
     FROM users u WHERE u.role = 'STUDENT' ORDER BY u.name`,
    [req.params.id]
  );
  const students = r.rows.map((s) => ({ ...s, reachedMinimum: s.votesGiven >= minVotes }));
  res.json({
    minVotes,
    maxVotes,
    voted: students.filter((s) => s.votesGiven > 0),
    notVoted: students.filter((s) => s.votesGiven === 0).map(({ votesGiven, reachedMinimum, ...s }) => s),
    // صوّتوا أقل من المطلوب (أو ما صوّتوا أبداً)
    belowMinimum: students.filter((s) => !s.reachedMinimum),
  });
});

// ============ الـ Labels ============

router.get("/labels", onlyStaff, async (req, res) => {
  const r = await db.query(
    `SELECT id, name, allowed_stars AS "allowedStars", severity, is_active AS "isActive"
     FROM labels ORDER BY severity, name`
  );
  res.json(r.rows);
});

// دالة فحص بيانات الـ label
function checkLabel({ name, allowedStars, severity }, partial = false) {
  if (!partial || name !== undefined) {
    if (!name || !String(name).trim()) return "Name is required";
  }
  if (!partial || allowedStars !== undefined) {
    if (!Array.isArray(allowedStars) || allowedStars.length === 0 ||
        allowedStars.some((s) => ![1, 2, 3].includes(s))) {
      return "allowedStars must be a list like [1, 2]";
    }
  }
  if (!partial || severity !== undefined) {
    if (!["POSITIVE", "MINOR", "SERIOUS"].includes(severity)) {
      return "severity must be POSITIVE, MINOR or SERIOUS";
    }
  }
  return null;
}

router.post("/labels", onlyStaff, async (req, res) => {
  const error = checkLabel(req.body);
  if (error) return res.status(400).json({ error });
  const { name, allowedStars, severity } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO labels (name, allowed_stars, severity) VALUES ($1, $2, $3)
       RETURNING id, name, allowed_stars AS "allowedStars", severity, is_active AS "isActive"`,
      [name.trim(), allowedStars, severity]
    );
    await audit(req.user.id, "CREATE_LABEL", { name });
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Label already exists" });
    throw err;
  }
});

router.patch("/labels/:id", onlyStaff, async (req, res) => {
  const error = checkLabel(req.body, true);
  if (error) return res.status(400).json({ error });
  const { name, allowedStars, severity, isActive } = req.body;
  const r = await db.query(
    `UPDATE labels SET
       name = COALESCE($2, name),
       allowed_stars = COALESCE($3, allowed_stars),
       severity = COALESCE($4, severity),
       is_active = COALESCE($5, is_active)
     WHERE id::text = $1
     RETURNING id, name, allowed_stars AS "allowedStars", severity, is_active AS "isActive"`,
    [req.params.id, name ?? null, allowedStars ?? null, severity ?? null, isActive ?? null]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: "Label not found" });
  await audit(req.user.id, "UPDATE_LABEL", { id: req.params.id, ...req.body });
  res.json(r.rows[0]);
});

router.delete("/labels/:id", onlyStaff, async (req, res) => {
  // إذا الـ label مستعملة بتقييمات، ما بنحذفها (عشان ما نخرب التاريخ) → بنوقفها بس
  const used = await db.query(`SELECT 1 FROM rating_labels WHERE label_id::text = $1 LIMIT 1`, [req.params.id]);
  if (used.rows.length > 0) {
    await db.query(`UPDATE labels SET is_active = false WHERE id::text = $1`, [req.params.id]);
    await audit(req.user.id, "DISABLE_LABEL", { id: req.params.id });
    return res.json({ deleted: false, disabled: true, message: "Label is used in ratings, so it was disabled instead" });
  }
  const r = await db.query(`DELETE FROM labels WHERE id::text = $1`, [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Label not found" });
  await audit(req.user.id, "DELETE_LABEL", { id: req.params.id });
  res.json({ deleted: true });
});

// ============ فترات التصويت ============

const WINDOW_FIELDS = `id, title, starts_at AS "startsAt", ends_at AS "endsAt",
  min_votes AS "minVotes", max_votes AS "maxVotes", is_active AS "isActive"`;

router.get("/windows", onlyStaff, async (req, res) => {
  const r = await db.query(`SELECT ${WINDOW_FIELDS} FROM voting_windows ORDER BY starts_at DESC`);
  res.json(r.rows);
});

router.post("/windows", onlyStaff, async (req, res) => {
  const { title, startsAt, endsAt, minVotes, maxVotes } = req.body;
  if (!startsAt || !endsAt) return res.status(400).json({ error: "startsAt and endsAt are required" });
  try {
    const r = await db.query(
      `INSERT INTO voting_windows (title, starts_at, ends_at, min_votes, max_votes)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${WINDOW_FIELDS}`,
      [title || "Voting window", startsAt, endsAt, minVotes ?? 1, maxVotes ?? 5]
    );
    await audit(req.user.id, "CREATE_WINDOW", req.body);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23514" || err.code === "22007" || err.code === "22008") {
      return res.status(400).json({ error: "Check the dates (end after start) and min ≤ max" });
    }
    throw err;
  }
});

router.patch("/windows/:id", onlyStaff, async (req, res) => {
  const { title, startsAt, endsAt, minVotes, maxVotes, isActive } = req.body;
  try {
    const r = await db.query(
      `UPDATE voting_windows SET
         title = COALESCE($2, title),
         starts_at = COALESCE($3, starts_at),
         ends_at = COALESCE($4, ends_at),
         min_votes = COALESCE($5, min_votes),
         max_votes = COALESCE($6, max_votes),
         is_active = COALESCE($7, is_active)
       WHERE id::text = $1 RETURNING ${WINDOW_FIELDS}`,
      [req.params.id, title ?? null, startsAt ?? null, endsAt ?? null,
       minVotes ?? null, maxVotes ?? null, isActive ?? null]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Window not found" });
    await audit(req.user.id, "UPDATE_WINDOW", { id: req.params.id, ...req.body });
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === "23514" || err.code === "22007" || err.code === "22008") {
      return res.status(400).json({ error: "Check the dates (end after start) and min ≤ max" });
    }
    throw err;
  }
});

// ============ إلغاء تقييم ============

// POST /api/staff/ratings/:id/invalidate
router.post("/ratings/:id/invalidate", onlyStaff, async (req, res) => {
  const reason = (req.body.reason || "").trim();
  if (!reason) return res.status(400).json({ error: "Reason is required" });
  const r = await db.query(
    `UPDATE ratings SET is_invalidated = true, invalidated_reason = $2,
       invalidated_by = $3, invalidated_at = now()
     WHERE id::text = $1 RETURNING id`,
    [req.params.id, reason, req.user.id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: "Rating not found" });
  await audit(req.user.id, "INVALIDATE_RATING", { id: req.params.id, reason });
  res.json({ invalidated: true });
});

// ============ تصدير CSV ============

// دالة بتحمي النص جوا الـ CSV (فواصل، علامات تنصيص، ومعادلات Excel)
function csvCell(value) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // يمنع Excel يشغّل معادلات
  return `"${s.replace(/"/g, '""')}"`;
}

// GET /api/staff/export.csv
router.get("/export.csv", onlyStaff, async (req, res) => {
  const r = await db.query(
    `SELECT r.id, w.title AS window, a.login AS rater, b.login AS ratee, r.stars,
       COALESCE((SELECT string_agg(l.name, '; ' ORDER BY l.name) FROM rating_labels rl
                 JOIN labels l ON l.id = rl.label_id WHERE rl.rating_id = r.id), '') AS labels,
       r.explanation, r.created_at, r.is_invalidated, r.invalidated_reason
     FROM ratings r
     JOIN users a ON a.id = r.rater_id
     JOIN users b ON b.id = r.ratee_id
     JOIN voting_windows w ON w.id = r.window_id
     ORDER BY r.created_at`
  );
  const header = ["rating_id", "window", "rater", "ratee", "stars", "labels",
                  "explanation", "created_at", "invalidated", "invalidated_reason"];
  const lines = [header.join(",")];
  for (const row of r.rows) {
    lines.push([row.id, row.window, row.rater, row.ratee, row.stars, row.labels,
      row.explanation, row.created_at.toISOString(), row.is_invalidated, row.invalidated_reason]
      .map(csvCell).join(","));
  }
  await audit(req.user.id, "EXPORT_CSV", { rows: r.rows.length });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ratings.csv"');
  res.send("﻿" + lines.join("\n")); // ﻿ عشان Excel يقرأ العربي صح
});

module.exports = router;
