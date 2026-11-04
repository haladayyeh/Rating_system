// بيعبّي الداتابيس ببيانات تجريبية: ستاف، طلاب، labels، وفترة تصويت
// شغّله بـ:  npm run seed
// ⚠️ بيمسح كل البيانات القديمة قبل ما يعبّي من جديد
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../src/db");

const STUDENTS = [
  ["hdaya", "Hala Daya"], ["amradwan", "Ammar Radwan"], ["amalsaka", "Amro Alsakaji"],
  ["rawabdal", "Rawd Abdallah"], ["yousef", "Yousef Nasser"], ["rana", "Rana Saleh"],
  ["khaled", "Khaled Mansour"], ["dana", "Dana Qasem"], ["zaid", "Zaid Hamdan"],
  ["noor", "Noor Awad"], ["hamza", "Hamza Odeh"], ["leen", "Leen Barakat"],
  ["mohammad", "Mohammad Issa"], ["tala", "Tala Jaber"], ["ali", "Ali Shami"],
  ["maya", "Maya Khatib"], ["faris", "Faris Daher"], ["jana", "Jana Rifai"],
  ["bashar", "Bashar Zoubi"], ["hala", "Hala Masri"],
];

// [الاسم, النجوم المسموحة, النوع] - من الدوكيومنت
const LABELS = [
  ["Helpful", [2, 3], "POSITIVE"],
  ["Good teammate", [2, 3], "POSITIVE"],
  ["Community contributor", [3], "POSITIVE"],
  ["Respectful", [2, 3], "POSITIVE"],
  ["Fair", [3], "POSITIVE"],
  ["Thorough", [3], "POSITIVE"],
  ["Clear explainer", [2, 3], "POSITIVE"],
  ["Helpful feedback", [3], "POSITIVE"],
  ["Well prepared", [3], "POSITIVE"],
  ["Knows their code", [2, 3], "POSITIVE"],
  ["Open to feedback", [3], "POSITIVE"],
  ["Unreliable teammate", [1, 2], "MINOR"],
  ["Disruptive", [1, 2], "MINOR"],
  ["Rushed", [1, 2], "MINOR"],
  ["Late", [1, 2], "MINOR"],
  ["Defensive", [1, 2], "MINOR"],
  ["Aggressive behavior", [1], "SERIOUS"],
  ["Disrespectful", [1], "SERIOUS"],
  ["Bad evaluator", [1], "SERIOUS"],
  ["Unprepared", [1], "SERIOUS"],
];

async function main() {
  console.log("Cleaning old data...");
  await db.query(`TRUNCATE audit_logs, abuse_cases, vote_attempts, rating_labels,
                  ratings, labels, voting_windows, users CASCADE`);

  // كل الحسابات التجريبية إلها نفس الباسورد: 123456
  const hash = await bcrypt.hash("123456", 10);

  console.log("Creating staff...");
  await db.query(
    `INSERT INTO users (login, name, password_hash, role) VALUES ($1, $2, $3, 'STAFF')`,
    ["staff", "Staff Admin", hash]
  );

  console.log("Creating students...");
  for (const [login, name] of STUDENTS) {
    await db.query(
      `INSERT INTO users (login, name, password_hash, role) VALUES ($1, $2, $3, 'STUDENT')`,
      [login, name, hash]
    );
  }

  console.log("Creating labels...");
  for (const [name, stars, severity] of LABELS) {
    await db.query(
      `INSERT INTO labels (name, allowed_stars, severity) VALUES ($1, $2, $3)`,
      [name, stars, severity]
    );
  }

  console.log("Creating voting window...");
  await db.query(
    `INSERT INTO voting_windows (title, starts_at, ends_at, min_votes, max_votes)
     VALUES ('Week 1 voting', now(), now() + interval '3 days', 2, 5)`
  );

  console.log("✅ Done! Login with any student (e.g. ahmad) or 'staff' — password: 123456");
  await db.end();
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err.code || "", err.message || "", err.errors || "");
  await db.end();
  process.exit(1);
});
