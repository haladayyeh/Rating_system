import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/ui";

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
          <p className="eyebrow eyebrow-light">Peer evaluation</p>
          <h1>
            Rate fairly &
            <br />
            <span className="hl-turq">Grow</span> <span className="hl-yellow">together.</span>
          </h1>
          <p>
            Recognize the peers who helped you most this week. Ratings stay anonymous, only
            averages are shown, and only after enough votes come in. Good luck!
          </p>
        </div>
        <div className="login-grid" aria-hidden="true">
          {Array.from({ length: 42 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i * 137) % 4000}ms` }} />
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
              placeholder="e.g. ahmad"
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
