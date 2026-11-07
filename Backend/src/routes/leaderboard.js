// لوحة "Top students": الستاف بيشوف الترتيب، وبيقرر إذا ووقتيش يشاركه مع الطلاب
const express = require("express");
const db = require("../db");
const { requireLogin, requireStaff, requireStudent } = require("../middleware/auth");

const router = express.Router();
const onlyStaff = [requireLogin, requireStaff];
const onlyStudents = [requireLogin, requireStudent];

// الطالب لازم يكون عنده 3 تقييمات على الأقل عشان يدخل الترتيب
// (عشان واحد عنده تقييم واحد 3 نجوم ما يطلع الأول)
const MIN_RATINGS_TO_RANK = 3;
const MAX_TOP_N = 100;

// الترتيب لفترة وحدة: أعلى متوسط أول، وإذا تساووا، اللي عنده تقييمات أكثر
async function getRanking(windowId) {
  const r = await db.query(
    `SELECT ROW_NUMBER() OVER (ORDER BY AVG(r.stars) DESC, COUNT(*) DESC, u.name)::int AS rank,
            u.id, u.login, u.name, u.nickname, u.nickname_icon AS "nicknameIcon",
            ROUND(AVG(r.stars)::numeric, 2)::float AS average,
            COUNT(*)::int AS "ratingsCount"
     FROM ratings r
     JOIN users u ON u.id = r.ratee_id
     WHERE r.window_id = $1 AND NOT r.is_invalidated AND u.role = 'STUDENT'
     GROUP BY u.id
     HAVING COUNT(*) >= $2
     ORDER BY rank`,
    [windowId, MIN_RATINGS_TO_RANK]
  );
  return r.rows;
}

const SETTINGS = `id, title, starts_at AS "startsAt", ends_at AS "endsAt",
  leaderboard_shared AS shared, leaderboard_top_n AS "topN",
  leaderboard_show_averages AS "showAverages", leaderboard_title AS "leaderboardTitle",
  leaderboard_shared_at AS "sharedAt"`;

// ============ الستاف ============

// GET /api/staff/leaderboard?windowId=...  → الترتيب الكامل + إعدادات المشاركة
router.get("/staff/leaderboard", onlyStaff, async (req, res) => {
  const windows = (await db.query(
    `SELECT ${SETTINGS} FROM voting_windows ORDER BY starts_at DESC`
  )).rows;
  if (windows.length === 0) return res.json({ windows: [], window: null, ranking: [] });

  // الفترة المطلوبة، وإلا المفتوحة هسا، وإلا آخر وحدة
  const now = new Date();
  const window =
    windows.find((w) => w.id === req.query.windowId) ||
    windows.find((w) => new Date(w.startsAt) <= now && now <= new Date(w.endsAt)) ||
    windows[0];

  const ranking = await getRanking(window.id);
  res.json({
    windows: windows.map((w) => ({ id: w.id, title: w.title, shared: w.shared })),
    window,
    minRatingsToRank: MIN_RATINGS_TO_RANK,
    ranking,
  });
});

// PATCH /api/staff/leaderboard/:windowId  body: { shared, topN, showAverages, title }
router.patch("/staff/leaderboard/:windowId", onlyStaff, async (req, res) => {
  const { shared, topN, showAverages, title } = req.body || {};

  if (shared !== undefined && typeof shared !== "boolean") {
    return res.status(400).json({ error: "shared must be true or false" });
  }
  if (topN !== undefined && (!Number.isInteger(topN) || topN < 1 || topN > MAX_TOP_N)) {
    return res.status(400).json({ error: `Number of students must be between 1 and ${MAX_TOP_N}` });
  }
  if (showAverages !== undefined && typeof showAverages !== "boolean") {
    return res.status(400).json({ error: "showAverages must be true or false" });
  }
  const cleanTitle = title === undefined ? null : String(title).trim();
  if (cleanTitle !== null && (cleanTitle.length === 0 || cleanTitle.length > 80)) {
    return res.status(400).json({ error: "Title must be 1 to 80 characters" });
  }

  const r = await db.query(
    `UPDATE voting_windows SET
       leaderboard_shared        = COALESCE($2, leaderboard_shared),
       leaderboard_top_n         = COALESCE($3, leaderboard_top_n),
       leaderboard_show_averages = COALESCE($4, leaderboard_show_averages),
       leaderboard_title         = COALESCE($5, leaderboard_title),
       -- وقت المشاركة: بيتسجّل لما الستاف يشغّلها
       leaderboard_shared_at = CASE
         WHEN $2 = true AND NOT leaderboard_shared THEN now()
         WHEN $2 = false THEN NULL
         ELSE leaderboard_shared_at END
     WHERE id::text = $1
     RETURNING ${SETTINGS}`,
    [req.params.windowId, shared ?? null, topN ?? null, showAverages ?? null, cleanTitle]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: "Window not found" });

  await db.query(
    `INSERT INTO audit_logs (actor_id, action, details) VALUES ($1, 'UPDATE_LEADERBOARD', $2)`,
    [req.user.id, { windowId: req.params.windowId, shared, topN, showAverages, title: cleanTitle }]
  );
  res.json(r.rows[0]);
});

// ============ الطالب ============

// GET /api/leaderboard → آخر لوحة شاركها الستاف (أول N بس)
router.get("/leaderboard", onlyStudents, async (req, res) => {
  const w = (await db.query(
    `SELECT ${SETTINGS} FROM voting_windows
     WHERE leaderboard_shared = true
     ORDER BY leaderboard_shared_at DESC NULLS LAST, starts_at DESC
     LIMIT 1`
  )).rows[0];

  if (!w) return res.json({ shared: false });

  const top = (await getRanking(w.id)).slice(0, w.topN);
  res.json({
    shared: true,
    title: w.leaderboardTitle,
    windowTitle: w.title,
    showAverages: w.showAverages,
    // بنرجّع الاسم بس (بدون id) : والمتوسط بس إذا الستاف سمح
    entries: top.map((s) => ({
      rank: s.rank,
      name: s.name,
      nickname: s.nickname,
      nicknameIcon: s.nicknameIcon,
      ...(w.showAverages ? { average: s.average } : {}),
      isMe: s.id === req.user.id,
    })),
  });
});

module.exports = router;
