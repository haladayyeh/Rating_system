import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/ui";

// شكل النجمة (نفس نجوم التقييم)
const STAR = "M12 2.5l2.9 6.1 6.7.9-4.9 4.7 1.2 6.7L12 17.7l-5.9 3.2 1.2-6.7-4.9-4.7 6.7-.9z";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(form.login.trim(), form.password);
      navigate(user.role === "STAFF" ? "/staff" : "/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <Logo />
        <div className="login-hero-copy">
          <h1>
            Rate fairly &
            <br />
            <span className="hl-turq">Grow</span> <span className="hl-yellow">together.</span>
          </h1>
        </div>
        <div className="login-grid" aria-hidden="true">
          {Array.from({ length: 42 }, (_, i) => (
            <svg key={i} viewBox="0 0 24 24" style={{ animationDelay: `${(i * 137) % 4000}ms` }}>
              <path d={STAR} />
            </svg>
          ))}
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="muted">Use your intra login.</p>
          <label className="field">
            <span>Login</span>
            <input
              className="input mono"
              autoComplete="username"
              autoFocus
              required
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
            
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
