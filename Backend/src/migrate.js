// تحديثات على الداتابيس بتنعمل لحالها لما السيرفر يشتغل
// IF NOT EXISTS يعني: إذا العمود موجود أصلاً، ما بيعمل إشي (آمن تشغيله كل مرة)
const fs = require("fs");
const path = require("path");
const db = require("./db");

async function migrate() {
  // 1) داتابيس جديدة فاضية؟ بنعمل كل الجداول من db/schema.sql
  const exists = await db.query(`SELECT to_regclass('public.users') AS t`);
  if (!exists.rows[0].t) {
    console.log("📦 Empty database — creating tables from db/schema.sql");
    const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(schema);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // 2) إعدادات لوحة "Top students" لكل فترة تصويت
  await db.query(`
    ALTER TABLE voting_windows
      ADD COLUMN IF NOT EXISTS leaderboard_shared        BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS leaderboard_top_n         INT     NOT NULL DEFAULT 10,
      ADD COLUMN IF NOT EXISTS leaderboard_show_averages BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS leaderboard_title         TEXT    NOT NULL DEFAULT 'Top students of the week',
      ADD COLUMN IF NOT EXISTS leaderboard_shared_at     TIMESTAMPTZ
  `);
}

module.exports = migrate;
