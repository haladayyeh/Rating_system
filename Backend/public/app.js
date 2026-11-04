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
  } else {
    $("studentView").classList.remove("hidden");
    $("staffView").classList.add("hidden");
    loadStudent();
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
    const [rating, votes, windowInfo, students] = await Promise.all([
      api("/me/rating"), api("/me/votes"), api("/windows/current"), api("/students")
    ]);
    $("averageValue").textContent = rating.visible ? rating.average.toFixed(1) : "—";
    $("averageHint").textContent = rating.visible ? "Based on received ratings" : rating.message;
    $("votesValue").textContent = `${votes.used} / ${votes.max}`;
    $("votesHint").textContent = `${votes.remaining} remaining · minimum ${votes.min}`;
    $("windowValue").textContent = windowInfo.isOpen ? "OPEN" : "CLOSED";
    $("windowHint").textContent = windowInfo.isOpen ? `Ends ${new Date(windowInfo.endsAt).toLocaleString()}` : "No active voting window";

    const select = $("studentSelect");
    select.innerHTML = '<option value="">Choose a student</option>';
    students.forEach((student) => {
      const option = document.createElement("option");
      option.value = student.id;
      option.textContent = `${student.name}${student.alreadyRated ? " — already rated" : ""}`;
      option.disabled = student.alreadyRated;
      select.appendChild(option);
    });
    if (!windowInfo.isOpen) $("ratingMessage").textContent = "Voting is currently closed.";
  } catch (err) {
    if (err.message.includes("token") || err.message.includes("Authentication")) logout();
    else toast(err.message);
  }
}

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
    $("abuseList").textContent = abuse.length ? JSON.stringify(abuse, null, 2) : "No abuse cases recorded.";
  } catch (err) {
    if (err.message.includes("token") || err.message.includes("Authentication")) logout();
    else toast(err.message);
  }
}




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



async function restoreSession() {
  if (!token) return;
  try {
    const user = await api("/auth/me");
    showLoggedIn(user);
  } catch {
    logout();
  }
}

loadLabels();
restoreSession();
