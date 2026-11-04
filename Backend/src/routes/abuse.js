// صفحة الغش للستاف: عرض الحالات، تأكيدها، رفضها
const express = require("express");
const db = require("../db");
const { requireLogin, requireStaff } = require("../middleware/auth");
const { runDetection } = require("../abuse/detectors");

const router = express.Router();
const onlyStaff = [requireLogin, requireStaff];

const TITLES = {
  BULK: "Bulk votes",
  REPEATED: "Repeated votes",
  GROUP: "Group voting",
  REVENGE: "Pair voting / revenge",
  FRIENDS_BOOST: "Friends boosting",
  TOO_FAST: "Too fast or too often",
  EXTREME_VOTER: "Extreme voter",
  MALICIOUS_SERIOUS: "Malicious serious vote",
};

// الفترة: اللي طلبها الستاف، وإلا المفتوحة، وإلا آخر وحدة
async function pickWindowId(windowId) {
  if (windowId) return windowId;
  const r = await db.query(
    `SELECT id FROM voting_windows
     ORDER BY (is_active AND now() BETWEEN starts_at AND ends_at) DESC, starts_at DESC LIMIT 1`
  );
  return r.rows[0] ? r.rows[0].id : null;
}

// GET /api/staff/abuse?status=OPEN&windowId=...
// بيشغّل الفحص أول، وبعدين بيرجّع كل الحالات
router.get("/", onlyStaff, async (req, res) => {
  const windowId = await pickWindowId(req.query.windowId);
  if (!windowId) return res.json([]);
  await runDetection(windowId);

  const params = [windowId];
  let statusFilter = "";
  if (req.query.status) {
    params.push(req.query.status);
    statusFilter = `AND c.status = $2`;
  }

  const r = await db.query(
    `SELECT c.id, c.type, c.severity, c.summary, c.status, c.detected_at AS "detectedAt",
            c.rating_ids AS "ratingIds", c.reviewed_at AS "reviewedAt",
            COALESCE((SELECT json_agg(json_build_object('id', u.id, 'login', u.login, 'name', u.name))
                      FROM users u WHERE u.id = ANY(c.student_ids)), '[]') AS students
     FROM abuse_cases c
     WHERE c.window_id = $1 ${statusFilter}
     ORDER BY CASE c.status WHEN 'OPEN' THEN 0 WHEN 'CONFIRMED' THEN 1 ELSE 2 END,
              CASE c.severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
              c.detected_at DESC`,
    params
  );
  res.json(r.rows.map((c) => ({ ...c, title: TITLES[c.type] })));
});

// GET /api/staff/abuse/:id → حالة وحدة مع تفاصيل التقييمات
router.get("/:id", onlyStaff, async (req, res) => {
  const c = await db.query(`SELECT * FROM abuse_cases WHERE id::text = $1`, [req.params.id]);
  if (c.rows.length === 0) return res.status(404).json({ error: "Case not found" });
  const ratings = await db.query(
    `SELECT r.id, r.stars, r.explanation, r.created_at AS "createdAt", r.is_invalidated AS invalidated,
            a.name AS "fromName", b.name AS "toName",
            COALESCE((SELECT json_agg(l.name) FROM rating_labels rl JOIN labels l ON l.id = rl.label_id
                      WHERE rl.rating_id = r.id), '[]') AS labels
     FROM ratings r JOIN users a ON a.id = r.rater_id JOIN users b ON b.id = r.ratee_id
     WHERE r.id = ANY($1) ORDER BY r.created_at`,
    [c.rows[0].rating_ids]
  );
  res.json({ ...c.rows[0], title: TITLES[c.rows[0].type], ratings: ratings.rows });
});

// POST /api/staff/abuse/:id/confirm  body: { invalidateRatings: true }
// تأكيد إنها غش، ومع خيار إلغاء التقييمات المتورطة
router.post("/:id/confirm", onlyStaff, async (req, res) => {
  const c = await db.query(
    `UPDATE abuse_cases SET status = 'CONFIRMED', reviewed_by = $2, reviewed_at = now()
     WHERE id::text = $1 RETURNING rating_ids`,
    [req.params.id, req.user.id]
  );
  if (c.rows.length === 0) return res.status(404).json({ error: "Case not found" });

  let invalidated = 0;
  if (req.body && req.body.invalidateRatings) {
    const r = await db.query(
      `UPDATE ratings SET is_invalidated = true, invalidated_reason = 'Confirmed abuse case',
         invalidated_by = $2, invalidated_at = now()
       WHERE id = ANY($1) AND NOT is_invalidated`,
      [c.rows[0].rating_ids, req.user.id]
    );
    invalidated = r.rowCount;
  }
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, details) VALUES ($1, 'CONFIRM_ABUSE', $2)`,
    [req.user.id, { caseId: req.params.id, invalidated }]
  );
  res.json({ status: "CONFIRMED", invalidated });
});

// POST /api/staff/abuse/:id/dismiss → مش غش
router.post("/:id/dismiss", onlyStaff, async (req, res) => {
  const c = await db.query(
    `UPDATE abuse_cases SET status = 'DISMISSED', reviewed_by = $2, reviewed_at = now()
     WHERE id::text = $1 RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (c.rows.length === 0) return res.status(404).json({ error: "Case not found" });
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, details) VALUES ($1, 'DISMISS_ABUSE', $2)`,
    [req.user.id, { caseId: req.params.id }]
  );
  res.json({ status: "DISMISSED" });
});

module.exports = router;
