const API = "/api";
let token = localStorage.getItem("rating_token") || "";
let currentUser = null;
let labelsCache = [];

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API + path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response;
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").style.display = "block";
  setTimeout(() => $("toast").style.display = "none", 3000);
}

function showLoggedIn(user) {
  currentUser = user;
  $("loginPanel").classList.add("hidden");
  $("appPanel").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("welcomeName").textContent = `Welcome, ${user.name}`;
  $("welcomeMeta").textContent = `@${user.login} · ${user.id}`;
  $("rolePill").textContent = user.role;
  if (user.role === "STAFF") {
    $("staffView").classList.remove("hidden");
    $("studentView").classList.add("hidden");
    loadStaff();
    loadStaffLeaderboard();
  } else {
    $("studentView").classList.remove("hidden");
    $("staffView").classList.add("hidden");
    loadStudent();
    loadLabels();
    loadStudentLeaderboard(); // نحمّل الـ labels بعد تسجيل الدخول (قبلها ما في token)
  }
}

function logout() {
  token = "";
  currentUser = null;
  localStorage.removeItem("rating_token");
  $("appPanel").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");
  $("logoutBtn").classList.add("hidden");
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("loginError").textContent = "";
  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: $("login").value, password: $("password").value })
    });
    token = result.token;
    localStorage.setItem("rating_token", token);
    showLoggedIn(result.user);
  } catch (err) {
    $("loginError").textContent = err.message;
  }
});

$("logoutBtn").addEventListener("click", logout);

async function loadStudent() {
  try {
    const [rating, votes, windowInfo] = await Promise.all([
      api("/me/rating"), api("/me/votes"), api("/windows/current")
    ]);
    $("averageValue").textContent = rating.visible ? rating.average.toFixed(1) : "—";
    $("averageHint").textContent = rating.visible ? "Based on received ratings" : rating.message;
    $("votesValue").textContent = `${votes.used} / ${votes.max}`;
    $("votesHint").textContent = `${votes.remaining} remaining · minimum ${votes.min}`;
    $("windowValue").textContent = windowInfo.isOpen ? "OPEN" : "CLOSED";
    $("windowHint").textContent = windowInfo.isOpen ? `Ends ${new Date(windowInfo.endsAt).toLocaleString()}` : "No active voting window";

    if (!windowInfo.isOpen) $("ratingMessage").textContent = "Voting is currently closed.";
  } catch (err) {
    if (err.message.includes("token") || err.message.includes("Authentication")) logout();
    else toast(err.message);
  }
}

// ---------- البحث عن طالب (عند الطالب) ----------
// بنستنى المستخدم يوقف كتابة شوي قبل ما نبعت الطلب
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function clearSelectedStudent() {
  $("studentSelect").value = "";
  $("selectedStudent").classList.add("hidden");
  $("selectedStudent").innerHTML = "";
  $("studentSearch").classList.remove("hidden");
}

function chooseStudent(student) {
  $("studentSelect").value = student.id;
  $("ratingMessage").textContent = "";
  $("studentResults").innerHTML = "";
  $("studentSearch").value = "";
  $("studentSearch").classList.add("hidden");

  const box = $("selectedStudent");
  box.innerHTML = "";
  const info = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = student.name;
  const login = document.createElement("span");
  login.className = "muted";
  login.textContent = ` @${student.login}`;
  info.append(name, login);

  const change = document.createElement("button");
  change.type = "button";
  change.className = "button secondary";
  change.textContent = "Change";
  change.addEventListener("click", () => {
    clearSelectedStudent();
    $("studentSearch").focus();
  });

  box.append(info, change);
  box.classList.remove("hidden");
}

async function searchStudents() {
  const q = $("studentSearch").value.trim();
  const results = $("studentResults");
  results.innerHTML = "";
  if (q.length < 2) {
    if (q.length === 1) results.innerHTML = '<p class="muted search-hint">Type at least 2 characters…</p>';
    return;
  }
  try {
    const students = await api(`/students?q=${encodeURIComponent(q)}`);
    if ($("studentSearch").value.trim() !== q) return; // المستخدم كمّل كتابة، تجاهل النتيجة القديمة
    if (!students.length) {
      results.innerHTML = '<p class="muted search-hint">No student found.</p>';
      return;
    }
    students.forEach((student) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-item";
      item.disabled = student.alreadyRated;

      const name = document.createElement("strong");
      name.textContent = student.name;
      const login = document.createElement("span");
      login.className = "muted";
      login.textContent = `@${student.login}`;
      item.append(name, login);

      if (student.alreadyRated) {
        const tag = document.createElement("small");
        tag.textContent = "already rated";
        item.appendChild(tag);
      } else {
        item.addEventListener("click", () => chooseStudent(student));
      }
      results.appendChild(item);
    });
  } catch (err) {
    results.innerHTML = "";
    toast(err.message);
  }
}

$("studentSearch").addEventListener("input", debounce(searchStudents));

async function loadLabels() {
  const stars = Number($("starsSelect").value);
  try {
    labelsCache = await api(`/labels?stars=${stars}`);
    const container = $("labelsList");
    container.innerHTML = "";
    if (!labelsCache.length) {
      container.textContent = "No labels are available for this star level.";
      updateExplanationVisibility();
      return;
    }
    labelsCache.forEach((label) => {
      const wrapper = document.createElement("label");
      wrapper.className = "check-label";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = label.id;
      checkbox.dataset.severity = label.severity;
      checkbox.addEventListener("change", updateExplanationVisibility);
      wrapper.append(checkbox, document.createTextNode(`${label.name} · ${label.severity.toLowerCase()}`));
      container.appendChild(wrapper);
    });
    updateExplanationVisibility();
  } catch (err) {
    toast(err.message);
  }
}

function updateExplanationVisibility() {
  const hasSerious = [...document.querySelectorAll("#labelsList input:checked")]
    .some((input) => input.dataset.severity === "SERIOUS");
  const required = Number($("starsSelect").value) === 1 && hasSerious;
  $("explanationWrap").classList.toggle("hidden", !required);
  $("explanation").required = required;
}

$("starsSelect").addEventListener("change", loadLabels);
$("refreshStudents").addEventListener("click", loadStudent);

$("ratingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const labelIds = [...document.querySelectorAll("#labelsList input:checked")].map((input) => input.value);
  if (!$("studentSelect").value) {
    $("ratingMessage").className = "message error";
    $("ratingMessage").textContent = "Search for a student and choose them first.";
    return;
  }
  const body = {
    rateeId: $("studentSelect").value,
    stars: Number($("starsSelect").value),
    labelIds,
    explanation: $("explanation").value
  };
  $("ratingMessage").className = "message";
  try {
    const result = await api("/ratings", { method: "POST", body: JSON.stringify(body) });
    $("ratingMessage").textContent = `Rating submitted. ${result.remaining} votes remaining.`;
    $("ratingMessage").classList.add("success");
    $("ratingForm").reset();
    clearSelectedStudent();
    $("starsSelect").value = "3";
    $("explanationWrap").classList.add("hidden");
    await loadLabels();
    await loadStudent();
  } catch (err) {
    $("ratingMessage").textContent = err.message;
    $("ratingMessage").classList.add("error");
  }
});

async function loadStaff() {
  try {
    const [overview, students, abuse] = await Promise.all([
      api("/staff/overview"), api("/staff/students"), api("/staff/abuse")
    ]);
    $("staffRatings").textContent = overview.totalRatings;
    $("staffStudents").textContent = overview.totalStudents;
    $("staffAbuse").textContent = overview.openAbuseCases;
    renderStaffTable(students);
    $("abuseList").textContent = abuse.length ? JSON.stringify(abuse, null, 2) : "No abuse cases recorded.";
  } catch (err) {
    if (err.message.includes("token") || err.message.includes("Authentication")) logout();
    else toast(err.message);
  }
}




// ---------- جدول الطلاب + البحث (عند الستاف) ----------
function renderStaffTable(students) {
  const tbody = $("staffTable");
  tbody.innerHTML = "";
  students.forEach((student) => {
    const tr = document.createElement("tr");
    const values = [student.name, student.login, student.average ?? "—", student.ratingsReceived, student.votesGiven];
    values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    const action = document.createElement("td");
    const button = document.createElement("button");
    button.className = "button secondary";
    button.textContent = "Details";
    button.setAttribute("data-student-id", student.id);
    button.addEventListener("click", () => loadStudentDetails(student.id));
    action.appendChild(button);
    tr.appendChild(action);
    tbody.appendChild(tr);
  });
}

async function searchStaffStudents() {
  const q = $("staffSearch").value.trim();
  const info = $("staffSearchInfo");
  try {
    if (q.length === 0) {
      info.textContent = "";
      renderStaffTable(await api("/staff/students"));
      return;
    }
    if (q.length < 2) {
      info.textContent = "Type at least 2 characters…";
      return;
    }
    const students = await api(`/staff/students?q=${encodeURIComponent(q)}`);
    if ($("staffSearch").value.trim() !== q) return;
    info.textContent = students.length
      ? `${students.length} student${students.length === 1 ? "" : "s"} found`
      : "No student found.";
    renderStaffTable(students);
    // إذا في نتيجة وحدة بس، افتح تفاصيلها على طول
    if (students.length === 1) loadStudentDetails(students[0].id);
  } catch (err) {
    toast(err.message);
  }
}

$("staffSearch").addEventListener("input", debounce(searchStaffStudents));

async function loadStudentDetails(id) {
  try {
    const details = await api(`/staff/students/${encodeURIComponent(id)}`);

    // Find the selected student's row
    const rows = Array.from(document.querySelectorAll("#staffTable tr"));

    rows.forEach((row) => {
      const next = row.nextElementSibling;

      if (next && next.classList.contains("expanded-details")) {
        next.remove();
      }
    });

    const selectedRow = rows.find((row) => {
      return row.querySelector("button")?.getAttribute("data-student-id") === id;
    });

    if (!selectedRow)
      return;

    // Calculate average using valid ratings only
    const validRatings = details.received.filter(
      (rating) => !rating.is_invalidated
    );

    let average = "—";

    if (validRatings.length > 0) {
      const total = validRatings.reduce(
        (sum, rating) => sum + rating.stars, 0
      );

      average = (total / validRatings.length).toFixed(1);
    }

    // EXPANDABLE ROW: quick overview
    const detailsRow = document.createElement("tr");
    detailsRow.className = "expanded-details";

    const detailsCell = document.createElement("td");
    detailsCell.colSpan = 6;

    const summary = document.createElement("div");
    summary.className = "student-expanded";

    summary.innerHTML = `
      <h3>${details.student.name}</h3>
      <p>Login: ${details.student.login}</p>

      <div class="expanded-stats">
        <div>
          <strong>${average}</strong>
          <span>Average rating</span>
        </div>

        <div>
          <strong>${details.received.length}</strong>
          <span>Votes received</span>
        </div>

        <div>
          <strong>${details.given.length}</strong>
          <span>Votes given</span>
        </div>
      </div>
    `;

    detailsCell.appendChild(summary);
    detailsRow.appendChild(detailsCell);
    selectedRow.after(detailsRow);

    // BOTTOM SECTION: full student details
    const container = $("staffDetails");
    container.innerHTML = "";

    const heading = document.createElement("h3");
    heading.textContent = details.student.name;

    const login = document.createElement("p");
    login.textContent = `Login: ${details.student.login}`;

    container.appendChild(heading);
    container.appendChild(login);

    // Helper to display a rating section
    function showRatings(title, ratings, personField) {
      const section = document.createElement("div");

      const sectionTitle = document.createElement("h3");
      sectionTitle.textContent = `${title} (${ratings.length})`;
      section.appendChild(sectionTitle);

      if (ratings.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No ratings found.";
        section.appendChild(empty);
      }

      ratings.forEach((rating) => {
        const card = document.createElement("div");
        card.className = "rating-card";

        const person = document.createElement("p");
        person.textContent = `${personField}: ${
          personField === "From" ? rating.raterName : rating.rateeName
        }`;

        const stars = document.createElement("p");
        stars.textContent = `Stars: ${rating.stars}/3`;

        const labels = document.createElement("p");

        const labelNames = rating.labels.map((label) => {
          return `${label.name} (${label.severity})`;
        });

        labels.textContent = `Flags / labels: ${
          labelNames.join(", ") || "None"
        }`;

        const explanation = document.createElement("p");
        explanation.textContent =
          `Explanation: ${rating.explanation || "None"}`;

        const date = document.createElement("p");
        date.textContent = `Date: ${
          new Date(rating.created_at).toLocaleString()
        }`;

        card.appendChild(person);
        card.appendChild(stars);
        card.appendChild(labels);
        card.appendChild(explanation);
        card.appendChild(date);

        if (rating.is_invalidated) {
          const invalidated = document.createElement("p");
          invalidated.textContent =
            `INVALIDATED: ${rating.invalidated_reason || "No reason provided"}`;

          card.appendChild(invalidated);
        }

        section.appendChild(card);
      });

      container.appendChild(section);
    }

    showRatings("Ratings received", details.received, "From");
    showRatings("Ratings given", details.given, "To");

  } catch (err) {
    toast(err.message);
  }
}



// ---------- لوحة Top students ----------
let lbState = { window: null, ranking: [] };

// بترسم القائمة: الاسم على اليسار، والمتوسط على اليمين
function renderLeaderboardList(list, entries, { showAverages = true, topN = Infinity } = {}) {
  list.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "lb-empty muted";
    empty.textContent = "No student has enough ratings to be ranked yet.";
    list.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "lb-row";
    if (entry.rank > topN) li.classList.add("lb-outside");
    if (entry.isMe) li.classList.add("lb-me");

    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = entry.rank;

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = entry.name + (entry.isMe ? " (you)" : "");

    li.append(rank, name);
    if (showAverages && entry.average !== undefined) {
      const avg = document.createElement("span");
      avg.className = "lb-avg";
      avg.textContent = entry.average.toFixed(2);
      li.appendChild(avg);
    }
    list.appendChild(li);
  });
}

// عند الطالب: بتبين بس إذا الستاف شاركها
async function loadStudentLeaderboard() {
  try {
    const board = await api("/leaderboard");
    const panel = $("leaderboardPanel");
    if (!board.shared) {
      panel.classList.add("hidden");
      return;
    }
    $("lbTitle").textContent = board.title;
    $("lbWindowName").textContent = board.windowTitle.toUpperCase();
    renderLeaderboardList($("lbList"), board.entries, { showAverages: board.showAverages });
    panel.classList.remove("hidden");
  } catch (err) {
    toast(err.message);
  }
}

// عند الستاف: الترتيب الكامل + إعدادات المشاركة
function renderStaffLeaderboard() {
  const w = lbState.window;
  if (!w) return;
  const topN = Number($("lbTopN").value) || w.topN;
  renderLeaderboardList($("lbStaffList"), lbState.ranking, { topN });

  const shown = Math.min(topN, lbState.ranking.length);
  if (w.shared) {
    $("lbStatus").className = "lb-status shared";
    $("lbStatus").textContent =
      `Shared with students since ${new Date(w.sharedAt).toLocaleString()} · showing top ${w.topN}` +
      (w.showAverages ? " with averages" : " (names only)");
    $("lbShareBtn").textContent = "Update shared board";
    $("lbStopBtn").classList.remove("hidden");
  } else {
    $("lbStatus").className = "lb-status";
    $("lbStatus").textContent = `Not shared. Students will see the top ${shown} when you share it.`;
    $("lbShareBtn").textContent = "Share with students";
    $("lbStopBtn").classList.add("hidden");
  }
}

async function loadStaffLeaderboard(windowId) {
  try {
    const data = await api("/staff/leaderboard" + (windowId ? `?windowId=${encodeURIComponent(windowId)}` : ""));
    lbState = { window: data.window, ranking: data.ranking };
    const select = $("lbWindowSelect");
    select.innerHTML = "";
    data.windows.forEach((w) => {
      const option = document.createElement("option");
      option.value = w.id;
      option.textContent = w.title + (w.shared ? " · shared" : "");
      select.appendChild(option);
    });
    if (!data.window) {
      $("lbStatus").textContent = "No voting windows yet.";
      return;
    }
    select.value = data.window.id;
    $("lbTitleInput").value = data.window.leaderboardTitle;
    $("lbTopN").value = data.window.topN;
    $("lbShowAvg").checked = data.window.showAverages;
    renderStaffLeaderboard();
  } catch (err) {
    toast(err.message);
  }
}

async function saveLeaderboard(shared) {
  const w = lbState.window;
  if (!w) return;
  const body = { shared };
  if (shared) {
    body.topN = Number($("lbTopN").value);
    body.showAverages = $("lbShowAvg").checked;
    body.title = $("lbTitleInput").value;
  }
  try {
    await api(`/staff/leaderboard/${encodeURIComponent(w.id)}`, { method: "PATCH", body: JSON.stringify(body) });
    toast(shared ? "Leaderboard shared with students" : "Leaderboard hidden from students");
    await loadStaffLeaderboard(w.id);
  } catch (err) {
    toast(err.message);
  }
}

$("lbTopN").addEventListener("input", renderStaffLeaderboard);
document.querySelectorAll(".lb-quick [data-top]").forEach((btn) =>
  btn.addEventListener("click", () => {
    $("lbTopN").value = btn.dataset.top;
    renderStaffLeaderboard();
  })
);
$("lbWindowSelect").addEventListener("change", (e) => loadStaffLeaderboard(e.target.value));
$("lbShareBtn").addEventListener("click", () => saveLeaderboard(true));
$("lbStopBtn").addEventListener("click", () => saveLeaderboard(false));

// ---------- تحميل الـ CSV ----------
// الرابط العادي ما بيبعت الـ token، فبنجيب الملف بـ fetch وبعدين بنحمّله
$("exportLink").addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    const response = await fetch(API + "/staff/export.csv", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Export failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ratings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("CSV downloaded");
  } catch (err) {
    toast(err.message);
  }
});

async function restoreSession() {
  if (!token) return;
  try {
    const user = await api("/auth/me");
    showLoggedIn(user);
  } catch {
    logout();
  }
}

restoreSession();
