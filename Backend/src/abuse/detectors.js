// =====================================================
// كشف الغش (Abuse detection)
// كل "detector" بيدوّر على نوع واحد من الغش، وبيرجّع "حالات" (cases)
// كل حالة فيها: النوع، الخطورة، جملة بلغة بسيطة، الطلاب، والتقييمات
// =====================================================
const db = require("../db");

// الأرقام اللي بتحدد شو "غريب". بتقدروا تغيروها بسهولة من هون
const RULES = {
  BULK_COUNT: 4,               // 4 تقييمات أو أكثر على نفس الطالب...
  BULK_MINUTES: 10,            // ...خلال 10 دقائق
  REPEATED_ATTEMPTS: 2,        // حاول يقيّم نفس الشخص مرتين زيادة بعد ما قيّمه
  GROUP_SIZE: 3,               // 3 طلاب أو أكثر أعطوا نفس التقييم بالضبط...
  GROUP_MINUTES: 30,           // ...خلال 30 دقيقة
  REVENGE_MINUTES: 60,         // ردّ بتقييم سيء خلال ساعة
  PAIR_HIGH_MINUTES: 10,       // اثنين أعطوا بعض 3 نجوم خلال 10 دقائق
  FRIENDS_GROUP_SIZE: 3,       // مجموعة من 3 أو أكثر كلهم أعطوا بعض 3 نجوم
  FAST_COUNT: 3,               // 3 تقييمات أو أكثر...
  FAST_SECONDS: 60,            // ...خلال دقيقة
  ATTEMPTS_COUNT: 8,           // أو 8 محاولات تصويت...
  ATTEMPTS_MINUTES: 5,         // ...خلال 5 دقائق
  EXTREME_MIN_VOTES: 4,        // لازم يكون عنده 4 أصوات على الأقل عشان نحكم عليه
  SERIOUS_OUTLIER_AVG: 2.5,    // الطالب متوسطه عالي من الباقيين...
  SERIOUS_OUTLIER_MIN_OTHERS: 3, // ...من 3 تقييمات ثانية على الأقل
  SERIOUS_WEAK_TEXT: 20,       // سبب أقصر من 20 حرف = سبب ضعيف
};

const minutes = (a, b) => Math.abs(new Date(a) - new Date(b)) / 60000;
const fmtMin = (m) => (m < 1 ? "less than a minute" : `${Math.round(m)} minute${Math.round(m) === 1 ? "" : "s"}`);

// بنجيب كل البيانات اللي بنحتاجها لفترة تصويت وحدة
async function loadData(windowId) {
  const ratings = (await db.query(
    `SELECT r.id, r.rater_id, r.ratee_id, r.stars, r.explanation, r.created_at,
            COALESCE(array_agg(l.name ORDER BY l.name) FILTER (WHERE l.id IS NOT NULL), '{}') AS labels,
            COALESCE(bool_or(l.severity = 'SERIOUS'), false) AS has_serious
     FROM ratings r
     LEFT JOIN rating_labels rl ON rl.rating_id = r.id
     LEFT JOIN labels l ON l.id = rl.label_id
     WHERE r.window_id = $1 AND NOT r.is_invalidated
     GROUP BY r.id
     ORDER BY r.created_at`,
    [windowId]
  )).rows;

  const attempts = (await db.query(
    `SELECT rater_id, ratee_id, result, created_at FROM vote_attempts
     WHERE window_id = $1 ORDER BY created_at`,
    [windowId]
  )).rows;

  const users = (await db.query(`SELECT id, login, name FROM users`)).rows;
  const name = {};
  users.forEach((u) => (name[u.id] = u.name));

  return { ratings, attempts, name };
}

// دالة مساعدة: بتجمّع عناصر حسب مفتاح
function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

// دالة مساعدة: أكبر مجموعة عناصر صارت خلال X دقائق (sliding window)
function densestBurst(items, maxMinutes) {
  let best = [];
  let start = 0;
  for (let end = 0; end < items.length; end++) {
    while (minutes(items[start].created_at, items[end].created_at) > maxMinutes) start++;
    if (end - start + 1 > best.length) best = items.slice(start, end + 1);
  }
  return best;
}

// ---------- 1) Bulk votes: كثير تقييمات على نفس الطالب بوقت قصير ----------
function detectBulk({ ratings, name }) {
  const cases = [];
  for (const [rateeId, list] of groupBy(ratings, (r) => r.ratee_id)) {
    const burst = densestBurst(list, RULES.BULK_MINUTES);
    if (burst.length >= RULES.BULK_COUNT) {
      const span = minutes(burst[0].created_at, burst[burst.length - 1].created_at);
      cases.push({
        type: "BULK",
        severity: burst.length >= RULES.BULK_COUNT * 2 ? "HIGH" : "MEDIUM",
        summary: `${name[rateeId]} received ${burst.length} ratings within ${fmtMin(span)}. That is much faster than normal.`,
        studentIds: [rateeId, ...new Set(burst.map((r) => r.rater_id))],
        ratingIds: burst.map((r) => r.id),
        key: `BULK:${rateeId}`,
      });
    }
  }
  return cases;
}

// ---------- 2) Repeated votes: نفس الطالب بيحاول يقيّم نفس الشخص مرة ورا مرة ----------
function detectRepeated({ attempts, ratings, name }) {
  const cases = [];
  const repeats = attempts.filter((a) => a.result === "ALREADY_RATED");
  for (const [key, list] of groupBy(repeats, (a) => `${a.rater_id}|${a.ratee_id}`)) {
    if (list.length >= RULES.REPEATED_ATTEMPTS) {
      const [raterId, rateeId] = key.split("|");
      const original = ratings.find((r) => r.rater_id === raterId && r.ratee_id === rateeId);
      cases.push({
        type: "REPEATED",
        severity: list.length >= RULES.REPEATED_ATTEMPTS * 3 ? "HIGH" : "MEDIUM",
        summary: `${name[raterId]} tried to rate ${name[rateeId]} ${list.length + 1} times in this window (only 1 is allowed).`,
        studentIds: [raterId, rateeId],
        ratingIds: original ? [original.id] : [],
        key: `REPEATED:${raterId}:${rateeId}`,
      });
    }
  }
  return cases;
}

// ---------- 3) Group voting: مجموعة أعطوا نفس التقييم بالضبط لنفس الشخص ----------
function detectGroup({ ratings, name }) {
  const cases = [];
  const groups = groupBy(ratings, (r) => `${r.ratee_id}|${r.stars}|${r.labels.join(",")}`);
  for (const [key, list] of groups) {
    const burst = densestBurst(list, RULES.GROUP_MINUTES);
    if (burst.length >= RULES.GROUP_SIZE) {
      const [rateeId, stars, labels] = key.split("|");
      const raters = burst.map((r) => r.rater_id);
      cases.push({
        type: "GROUP",
        severity: Number(stars) === 1 ? "HIGH" : "MEDIUM",
        summary: `${burst.length} students (${raters.map((id) => name[id]).join(", ")}) gave ${name[rateeId]} exactly the same rating — ${stars} star${stars === "1" ? "" : "s"} with "${labels || "no labels"}" — within ${fmtMin(minutes(burst[0].created_at, burst[burst.length - 1].created_at))}.`,
        studentIds: [rateeId, ...raters],
        ratingIds: burst.map((r) => r.id),
        key: `GROUP:${key}`,
      });
    }
  }
  return cases;
}

// ---------- 4) Pair voting / revenge: اثنين قيّموا بعض ----------
function detectPairs({ ratings, name }) {
  const cases = [];
  const byPair = new Map();
  ratings.forEach((r) => byPair.set(`${r.rater_id}|${r.ratee_id}`, r));
  const seen = new Set();

  for (const r of ratings) {
    const back = byPair.get(`${r.ratee_id}|${r.rater_id}`);
    if (!back) continue;
    const pairKey = [r.rater_id, r.ratee_id].sort().join(":");
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const [first, second] = new Date(r.created_at) <= new Date(back.created_at) ? [r, back] : [back, r];
    const gap = minutes(first.created_at, second.created_at);
    const A = name[first.rater_id];
    const B = name[second.rater_id];

    // انتقام: الأول أعطى تقييم سيء، والثاني ردّ بتقييم سيء
    if (first.stars <= 2 && second.stars === 1) {
      cases.push({
        type: "REVENGE",
        severity: gap <= RULES.REVENGE_MINUTES ? "HIGH" : "MEDIUM",
        summary: `${A} gave ${B} ${first.stars} star${first.stars === 1 ? "" : "s"}, and ${B} answered with 1 star ${fmtMin(gap)} later. This looks like revenge.`,
        studentIds: [first.rater_id, second.rater_id],
        ratingIds: [first.id, second.id],
        key: `REVENGE:${pairKey}`,
      });
    }
    // تبادل: اثنين أعطوا بعض 3 نجوم بسرعة
    else if (first.stars === 3 && second.stars === 3 && gap <= RULES.PAIR_HIGH_MINUTES) {
      cases.push({
        type: "REVENGE",
        severity: "LOW",
        summary: `${A} and ${B} gave each other 3 stars within ${fmtMin(gap)}. This may be a vote exchange.`,
        studentIds: [first.rater_id, second.rater_id],
        ratingIds: [first.id, second.id],
        key: `PAIR:${pairKey}`,
      });
    }
  }
  return cases;
}

// ---------- 5) Friends boosting: مجموعة كلهم أعطوا بعض 3 نجوم ----------
function detectFriends({ ratings, name }) {
  // بنعمل "شبكة": خط بين أي اثنين أعطوا بعض 3 نجوم
  const high = new Map();
  ratings.filter((r) => r.stars === 3).forEach((r) => high.set(`${r.rater_id}|${r.ratee_id}`, r));
  const neighbors = new Map();
  for (const key of high.keys()) {
    const [a, b] = key.split("|");
    if (high.has(`${b}|${a}`)) {
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      neighbors.get(a).add(b);
    }
  }

  // بندوّر على أكبر مجموعات كل واحد فيها مربوط بالكل (Bron–Kerbosch)
  const cliques = [];
  function search(R, P, X) {
    if (P.size === 0 && X.size === 0) {
      if (R.length >= RULES.FRIENDS_GROUP_SIZE) cliques.push(R);
      return;
    }
    for (const v of [...P]) {
      const N = neighbors.get(v) || new Set();
      search([...R, v], new Set([...P].filter((x) => N.has(x))), new Set([...X].filter((x) => N.has(x))));
      P.delete(v);
      X.add(v);
    }
  }
  search([], new Set(neighbors.keys()), new Set());

  return cliques.map((group) => {
    const ids = group.sort();
    const ratingIds = [];
    for (const a of ids) for (const b of ids) if (a !== b && high.has(`${a}|${b}`)) ratingIds.push(high.get(`${a}|${b}`).id);
    return {
      type: "FRIENDS_BOOST",
      severity: ids.length >= 4 ? "HIGH" : "MEDIUM",
      summary: `${ids.length} students (${ids.map((id) => name[id]).join(", ")}) all gave each other 3 stars. This looks like a group boosting each other.`,
      studentIds: ids,
      ratingIds,
      key: `FRIENDS:${ids.join(":")}`,
    };
  });
}

// ---------- 6) Too fast or too often: تصويت سريع جداً أو كثير جداً ----------
function detectTooFast({ ratings, attempts, name }) {
  const cases = [];
  for (const [raterId, list] of groupBy(ratings, (r) => r.rater_id)) {
    const burst = densestBurst(list, RULES.FAST_SECONDS / 60);
    if (burst.length >= RULES.FAST_COUNT) {
      const secs = Math.round(minutes(burst[0].created_at, burst[burst.length - 1].created_at) * 60);
      cases.push({
        type: "TOO_FAST",
        severity: "MEDIUM",
        summary: `${name[raterId]} rated ${burst.length} different students in ${secs} seconds. That is too fast to be a thoughtful rating.`,
        studentIds: [raterId, ...burst.map((r) => r.ratee_id)],
        ratingIds: burst.map((r) => r.id),
        key: `FAST:${raterId}`,
      });
    }
  }
  for (const [raterId, list] of groupBy(attempts, (a) => a.rater_id)) {
    const burst = densestBurst(list, RULES.ATTEMPTS_MINUTES);
    if (burst.length >= RULES.ATTEMPTS_COUNT) {
      cases.push({
        type: "TOO_FAST",
        severity: "HIGH",
        summary: `${name[raterId]} made ${burst.length} voting attempts within ${RULES.ATTEMPTS_MINUTES} minutes. This is an unusual volume.`,
        studentIds: [raterId],
        ratingIds: [],
        key: `ATTEMPTS:${raterId}`,
      });
    }
  }
  return cases;
}

// ---------- 7) Extreme voter: دايماً نجمة وحدة أو دايماً 3 نجوم ----------
function detectExtreme({ ratings, name }) {
  const cases = [];
  for (const [raterId, list] of groupBy(ratings, (r) => r.rater_id)) {
    if (list.length < RULES.EXTREME_MIN_VOTES) continue;
    const allSame = list.every((r) => r.stars === list[0].stars);
    if (allSame && (list[0].stars === 1 || list[0].stars === 3)) {
      const stars = list[0].stars;
      cases.push({
        type: "EXTREME_VOTER",
        severity: stars === 1 ? "HIGH" : "LOW",
        summary: `${name[raterId]} gave ${stars === 1 ? "only 1 star" : "only 3 stars"} in all ${list.length} of their ratings.`,
        studentIds: [raterId],
        ratingIds: list.map((r) => r.id),
        key: `EXTREME:${raterId}`,
      });
    }
  }
  return cases;
}

// ---------- 8) Malicious serious vote: نجمة وحدة مع اتهام خطير مشكوك فيه ----------
function detectMaliciousSerious({ ratings, name }) {
  const cases = [];
  const serious = ratings.filter((r) => r.stars === 1 && r.has_serious);

  for (const r of serious) {
    const reasons = [];
    const text = (r.explanation || "").trim();

    // أ) الباقيين شايفينه منيح
    const others = ratings.filter((o) => o.ratee_id === r.ratee_id && o.id !== r.id);
    const avg = others.length ? others.reduce((s, o) => s + o.stars, 0) / others.length : null;
    if (others.length >= RULES.SERIOUS_OUTLIER_MIN_OTHERS && avg >= RULES.SERIOUS_OUTLIER_AVG) {
      reasons.push(`${others.length} other students rated ${name[r.ratee_id]} ${avg.toFixed(1)} stars on average`);
    }
    // ب) السبب ضعيف أو مكرر
    const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, "")).size;
    if (text.length < RULES.SERIOUS_WEAK_TEXT || uniqueChars < 5) {
      reasons.push(`the explanation is very short or meaningless ("${text}")`);
    }
    const copied = ratings.filter((o) => o.id !== r.id && o.rater_id === r.rater_id &&
      (o.explanation || "").trim().toLowerCase() === text.toLowerCase() && text);
    if (copied.length > 0) {
      reasons.push(`the same explanation was copied into ${copied.length + 1} ratings`);
    }
    // ج) ما حدا ثاني اشتكى
    const othersNegative = others.some((o) => o.stars === 1 || o.has_serious);
    if (others.length >= 2 && !othersNegative && reasons.length === 0) {
      reasons.push(`no other student reported any serious issue`);
    }

    if (reasons.length > 0) {
      cases.push({
        type: "MALICIOUS_SERIOUS",
        severity: reasons.length >= 2 ? "HIGH" : "MEDIUM",
        summary: `${name[r.rater_id]} gave ${name[r.ratee_id]} 1 star with a serious flag (${r.labels.join(", ")}), but ${reasons.join(", and ")}.`,
        studentIds: [r.rater_id, r.ratee_id],
        ratingIds: [r.id, ...copied.map((c) => c.id)],
        key: `MALICIOUS:${r.id}`,
      });
    }
  }
  return cases;
}

const DETECTORS = [
  detectBulk, detectRepeated, detectGroup, detectPairs,
  detectFriends, detectTooFast, detectExtreme, detectMaliciousSerious,
];

// بيشغّل كل الـ detectors على فترة وحدة، وبيخزّن النتائج
async function runDetection(windowId) {
  const data = await loadData(windowId);
  const cases = DETECTORS.flatMap((detect) => detect(data));

  for (const c of cases) {
    // إذا الحالة موجودة قبل، بنحدّث تفاصيلها بس (وبنخلي قرار الستاف زي ما هو)
    await db.query(
      `INSERT INTO abuse_cases (window_id, type, severity, summary, student_ids, rating_ids, case_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (case_key) DO UPDATE SET
         severity = EXCLUDED.severity,
         summary = EXCLUDED.summary,
         student_ids = EXCLUDED.student_ids,
         rating_ids = EXCLUDED.rating_ids`,
      [windowId, c.type, c.severity, c.summary, c.studentIds, c.ratingIds, `${windowId}:${c.key}`]
    );
  }
  return cases.length;
}

module.exports = { runDetection, RULES };
