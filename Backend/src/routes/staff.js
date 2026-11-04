// كل إشي الستاف بيعمله
const express = require("express");
const db = require("../db");
const { requireLogin, requireStaff } = require("../middleware/auth");

const router = express.Router();

// كل رابط هون لازم يكون مسجّل دخول + STAFF
const onlyStaff = [requireLogin, requireStaff];

// GET /api/staff/overview
router.get("/overview", onlyStaff, async (req, res) => {
  const result = await db.query(`
    SELECT
      (SELECT COUNT(*)::int
       FROM ratings
       WHERE is_invalidated = false) AS "totalRatings",

      (SELECT COUNT(*)::int
       FROM users
       WHERE role = 'STUDENT') AS "totalStudents",

      (SELECT COUNT(*)::int
       FROM abuse_cases
       WHERE status = 'OPEN') AS "openAbuseCases"
  `);

  res.json(result.rows[0]);
});


// GET /api/staff/students
router.get("/students", onlyStaff, async (req, res) => {
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
    ORDER BY u.name
  `);

  res.json(result.rows);
});


// GET /api/staff/abuse
router.get("/abuse", onlyStaff, async (req, res) => {
  const result = await db.query(`
    SELECT
      id,
      type,
      severity,
      summary,
      status,
      student_ids,
      rating_ids,
      detected_at
    FROM abuse_cases
    ORDER BY detected_at DESC
  `);

  res.json(result.rows);
});


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

  res.json({
    student,
    received: received.rows,
    given: given.rows
  });
});


module.exports = router;
