// بيعبّي تقييمات تجريبية للديمو: تقييمات طبيعية + حالة من كل نوع غش
// شغّله بعد npm run seed:   npm run seed:demo
// ⚠️ بيمسح كل التقييمات الموجودة
require("../src/config");
const db = require("../src/db");

async function main() {
  const students = (await db.query(
    `SELECT id, name FROM users WHERE role = 'STUDENT' ORDER BY created_at, login`
  )).rows;
  if (students.length < 20) throw new Error("Need at least 20 students. Run npm run seed first.");
  const s = students.map((x) => x.id);

  const labels = {};
  (await db.query(`SELECT id, name FROM labels`)).rows.forEach((l) => (labels[l.name] = l.id));

  // الفترة المفتوحة: بنخليها بلشت من يوم، عشان التقييمات القديمة تكون جواها
  const w = (await db.query(
    `UPDATE voting_windows SET starts_at = now() - interval '1 day'
     WHERE id = (SELECT id FROM voting_windows ORDER BY starts_at DESC LIMIT 1)
     RETURNING id`
  )).rows[0];
  if (!w) throw new Error("No voting window. Run npm run seed first.");

  console.log("Cleaning old ratings...");
  await db.query(`TRUNCATE abuse_cases, vote_attempts, rating_labels, ratings CASCADE`);

  // دالة: بتضيف تقييم بوقت معين (قبل كذا دقيقة من هسا)
  async function rate(rater, ratee, stars, labelNames, minutesAgo, explanation = null) {
    const r = await db.query(
      `INSERT INTO ratings (rater_id, ratee_id, window_id, stars, explanation, created_at)
       VALUES ($1, $2, $3, $4, $5, now() - make_interval(secs => $6))
       ON CONFLICT DO NOTHING RETURNING id`,
      [s[rater], s[ratee], w.id, stars, explanation, Math.round(minutesAgo * 60)]
    );
    if (!r.rows[0]) return;
    for (const name of labelNames) {
      await db.query(`INSERT INTO rating_labels (rating_id, label_id) VALUES ($1, $2)`, [r.rows[0].id, labels[name]]);
    }
  }

  console.log("Normal ratings...");
  // كل طالب بيقيّم اللي بعده (3 نجوم) واللي بعد 3 (نجمتين) — بدون تبادل وبأوقات متباعدة
  const happy = ["Helpful", "Good teammate", "Clear explainer", "Respectful", "Knows their code", "Thorough", "Well prepared"];
  const okay = ["Helpful", "Late", "Rushed", "Clear explainer", "Defensive", "Good teammate"];
  const skip = new Set([4]); // طالب رقم 4 هو الـ "extreme voter"، فما بنعطيه تقييمات طبيعية
  let t = 600;
  for (let i = 0; i < 20; i++) {
    if (skip.has(i)) continue;
    await rate(i, (i + 1) % 20, 3, [happy[i % happy.length]], (t -= 7));
  }
  for (let i = 0; i < 20; i++) {
    if (skip.has(i)) continue;
    await rate(i, (i + 3) % 20, 2, [okay[i % okay.length]], (t -= 7));
  }

  console.log("1) Bulk votes...");
  // 5 تقييمات على طالب 0 خلال 6 دقائق
  const bulk = [[10, "Late"], [11, "Rushed"], [12, "Helpful"], [14, "Defensive"], [15, "Good teammate"]];
  for (let k = 0; k < bulk.length; k++) await rate(bulk[k][0], 0, 2, [bulk[k][1]], 90 - k * 1.5);

  console.log("2) Repeated votes...");
  // طالب 5 قيّم طالب 6، وبعدين حاول 3 مرات كمان
  for (let k = 0; k < 3; k++) {
    await db.query(
      `INSERT INTO vote_attempts (rater_id, ratee_id, window_id, result, created_at)
       VALUES ($1, $2, $3, 'ALREADY_RATED', now() - make_interval(mins => $4))`,
      [s[5], s[6], w.id, 80 - k * 2]
    );
  }

  console.log("3) Group voting...");
  // 3 طلاب أعطوا طالب 7 نفس التقييم بالضبط خلال 10 دقائق
  await rate(15, 7, 1, ["Disruptive"], 70);
  await rate(16, 7, 1, ["Disruptive"], 65);
  await rate(17, 7, 1, ["Disruptive"], 61);

  console.log("4) Revenge...");
  // طالب 2 أعطى طالب 12 نجمتين، وطالب 12 ردّ بنجمة بعد 5 دقائق
  await rate(2, 12, 2, ["Late"], 55);
  await rate(12, 2, 1, ["Disrespectful"], 50, "He was rude to me during the evaluation and laughed at my code");

  console.log("5) Friends boosting...");
  // طلاب 16 و 17 و 18 كلهم أعطوا بعض 3 نجوم (بأوقات متباعدة)
  await rate(17, 16, 3, ["Helpful"], 200);
  await rate(16, 18, 3, ["Good teammate"], 180);
  await rate(18, 16, 3, ["Helpful"], 160);
  await rate(18, 17, 3, ["Knows their code"], 140);

  console.log("6) Too fast...");
  // طالب 19 قيّم 3 طلاب خلال 40 ثانية
  await rate(19, 4, 2, ["Rushed"], 30);
  await rate(19, 8, 3, ["Helpful"], 29.7);
  await rate(19, 11, 2, ["Late"], 29.4);

  console.log("7) Extreme voter...");
  // طالب 4 أعطى نجمة وحدة لكل اللي قيّمهم
  for (const [k, victim] of [6, 8, 10, 12].entries()) await rate(4, victim, 1, ["Rushed"], 300 - k * 40);

  console.log("8) Malicious serious vote...");
  // طالب 5 الكل شايفه منيح، بس طالب 11 أعطاه نجمة مع اتهام خطير وسبب فاضي
  await rate(6, 5, 3, ["Helpful"], 250);
  await rate(7, 5, 3, ["Respectful"], 230);
  await rate(8, 5, 3, ["Clear explainer"], 210);
  await rate(11, 5, 1, ["Aggressive behavior"], 20, "bad bad bad");

  const count = (await db.query(`SELECT COUNT(*)::int AS c FROM ratings`)).rows[0].c;
  console.log(`✅ Done! ${count} ratings created. Open the abuse page as staff to see the cases.`);
  await db.end();
}

main().catch(async (err) => {
  console.error("❌ Demo seed failed:", err.message);
  await db.end();
  process.exit(1);
});
