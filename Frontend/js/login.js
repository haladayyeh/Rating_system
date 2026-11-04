// صفحة تسجيل الدخول: بتبعت الاسم والباسورد للباك اند، وبتخزّن الـ token
// النظام بيعرف لحاله إذا الحساب طالب ولا ستاف، وبيوديه على صفحته
const $ = (id) => document.getElementById(id);

const form = $("login-form");
const loginInput = $("intra-login");
const passwordInput = $("intra-password");
const signinBtn = $("signin-btn");
const stars = $("stars");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- إظهار / إخفاء الباسورد ----------
$("toggle-visibility").addEventListener("click", (e) => {
  const btn = e.currentTarget;
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  btn.setAttribute("aria-pressed", String(show));
  btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

// ---------- حالة النجوم: loading / error / success ----------
function setStars(state) {
  stars.classList.remove("is-loading", "is-error", "is-success");
  if (state) {
    void stars.offsetWidth; // عشان الحركة تنعاد من الأول كل مرة
    stars.classList.add(`is-${state}`);
  }
}

// ---------- رسائل ----------
function showError(message) {
  $("error-text").textContent = message;
  $("error-box").classList.remove("hidden");
  loginInput.classList.add("invalid");
  passwordInput.classList.add("invalid");
  setStars("error");
  // بعد شوي النجوم بترجع تتعبّى
  setTimeout(() => stars.classList.contains("is-error") && setStars(null), 1200);
}

function hideError() {
  $("error-box").classList.add("hidden");
  loginInput.classList.remove("invalid");
  passwordInput.classList.remove("invalid");
}

function setLoading(isLoading) {
  signinBtn.disabled = isLoading;
  signinBtn.textContent = isLoading ? "Signing in…" : "Sign in";
  if (isLoading) setStars("loading");
}

// أول ما يبلش يكتب من جديد، بنخفي الخطأ
loginInput.addEventListener("input", hideError);
passwordInput.addEventListener("input", hideError);

// ---------- تسجيل الدخول ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  $("success-box").classList.add("hidden");

  const login = loginInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!login || !password) {
    showError("Please enter your intra name and password");
    return;
  }

  setLoading(true);
  try {
    // بنستنى نص ثانية على الأقل، عشان حركة النجوم تبين حتى لو السيرفر سريع
    const [response] = await Promise.all([
      fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      }),
      wait(600),
    ]);
    const data = await response.json().catch(() => ({}));

    if (response.status === 429) {
      showError("Too many attempts. Please wait a few minutes and try again.");
      return;
    }
    if (!response.ok) {
      showError("Wrong intra name or password");
      return;
    }

    // نجح: بنخزّن الـ token عشان باقي الصفحات تستعمله
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    setStars("success");
    $("success-box").textContent = `Welcome, ${data.user.name}! Loading your dashboard…`;
    $("success-box").classList.remove("hidden");

    // الطالب بيروح على صفحة الطالب، والستاف على صفحة الستاف
    const next = data.user.role === "STAFF" ? "staff.html" : "student.html";
    setTimeout(() => (window.location.href = next), 1200);
  } catch (err) {
    showError("Can't reach the server. Is the backend running?");
  } finally {
    setLoading(false);
  }
});
