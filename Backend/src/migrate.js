// تحديثات على الداتابيس بتنعمل لحالها لما السيرفر يشتغل
// IF NOT EXISTS يعني: إذا العمود موجود أصلاً، ما بيعمل إشي (آمن تشغيله كل مرة)
const db = require("./db");

async function migrate() {
  // إعدادات لوحة "Top students" لكل فترة تصويت
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
