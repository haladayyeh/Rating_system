import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/ui";
import PixelIcon from "../components/PixelIcon";

// شبكة 8×7 مربع. بعض المربعات فيها "غنائم" ثابتة (نجوم وعملات...)،
// وكل كم ثانية بتطلع غنيمة جديدة بمربع فاضي وبعدين بتختفي — زي خريطة لعبة
const GRID_COLS = 8;
const GRID_ROWS = 7;
const GRID_CELLS = GRID_COLS * GRID_ROWS;
const FIXED_LOOT = { 2: "star-gold", 12: "coin", 19: "star-gold", 29: "crystal", 36: "star-gold", 43: "key-gold" };
const SPAWN_LOOT = ["star-gold", "coin", "crystal", "key-gold", "ruby", "heart", "gift", "potion-teal"];
const SPAWN_EVERY = 2600; // ms
const SPAWN_LIFE = 3200; // ms

// 5 قلوب = 10 أنصاص = نفس حد السيرفر (10 محاولات كل 15 دقيقة لنفس اللوجن)
const HEARTS = 5;
const MAX_TRIES = HEARTS * 2;
const UNLOCK_MS = 450;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function LootGrid() {
  const [spawns, setSpawns] = useState({}); // cell index -> { icon, id }

  useEffect(() => {
    if (reducedMotion()) return;
    let id = 0;
    const timer = setInterval(() => {
      setSpawns((cur) => {
        const free = [];
        for (let i = 0; i < GRID_CELLS; i++) if (!FIXED_LOOT[i] && !cur[i]) free.push(i);
        const cell = free[Math.floor(Math.random() * free.length)];
        const icon = SPAWN_LOOT[Math.floor(Math.random() * SPAWN_LOOT.length)];
        const key = ++id;
        setTimeout(() => setSpawns((c) => {
          if (c[cell]?.id !== key) return c;
          const next = { ...c };
          delete next[cell];
          return next;
        }), SPAWN_LIFE);
        return { ...cur, [cell]: { icon, id: key } };
      });
    }, SPAWN_EVERY);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="login-grid" aria-hidden="true">
      {Array.from({ length: GRID_CELLS }, (_, i) => {
        const style = { animationDelay: `${(i * 137) % 4000}ms` };
        const fixed = FIXED_LOOT[i];
        const spawn = spawns[i];
        return (
          <span key={i} style={style} className={fixed || spawn ? "has-loot" : ""}>
            {fixed && <PixelIcon name={fixed} size={44} className="loot" style={{ animationDelay: `${(i * 211) % 1600}ms` }} />}
            {spawn && <PixelIcon key={spawn.id} name={spawn.icon} size={44} className="loot loot-spawn" />}
          </span>
        );
      })}
    </div>
  );
}

function Lives({ tries }) {
  const left = Math.max(MAX_TRIES - tries, 0); // halves left
  return (
    <span className="lives" role="img" aria-label={`${left / 2} of ${HEARTS} lives left`}>
      {Array.from({ length: HEARTS }, (_, i) => {
        const halves = Math.min(Math.max(left - i * 2, 0), 2);
        const name = halves === 2 ? "heart" : halves === 1 ? "heart-half" : "heart-empty";
        return <PixelIcon key={`${i}-${name}`} name={name} size={18} className={halves < 2 ? "life-lost" : ""} />;
      })}
    </span>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);
  const [shake, setShake] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const lastLogin = useRef("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const name = form.login.trim();
    // السيرفر بيعدّ المحاولات لكل لوجن لحاله، فلوجن جديد = قلوب جديدة
    const base = name.toLowerCase() === lastLogin.current ? tries : 0;
    lastLogin.current = name.toLowerCase();
    try {
      const user = await login(name, form.password, async () => {
        if (reducedMotion()) return;
        setUnlocked(true);
        await sleep(UNLOCK_MS);
      });
      navigate(user.role === "STAFF" ? "/staff" : "/", { replace: true });
    } catch (err) {
      if (err.status === 401) setTries(base + 1);
      else if (err.status === 429) setTries(MAX_TRIES);
      else setTries(base);
      setError(err.status === 429 ? `Out of lives! ${err.message}` : err.message);
      setShake((n) => n + 1);
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
        <LootGrid />
      </section>

      <section className="login-panel">
        <form
          key={shake}
          className={`login-card ${shake ? "is-shaking" : ""} ${unlocked ? "is-unlocked" : ""}`}
          onSubmit={submit}
        >
          <div className="login-hud">
            <span className="player-tag">Player 1</span>
            <Lives tries={tries} />
          </div>
          <h2>Sign in</h2>
          <p className="muted">Use your intra login.</p>
          <label className="field">
            <span>Login</span>
            <span className="input-icon">
              <PixelIcon name="helmet" size={20} />
              <input
                className="input mono"
                autoComplete="username"
                autoFocus={!shake}
                required
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
              />
            </span>
          </label>
          <label className="field">
            <span>Password</span>
            <span className={`input-icon ${form.password ? "is-key-gold" : ""}`}>
              <PixelIcon
                key={form.password ? "gold" : "silver"}
                name={form.password ? "key-gold" : "key-silver"}
                size={20}
              />
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                autoFocus={!!shake}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </span>
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {unlocked ? "Unlocked!" : busy ? "Loading…" : "Press start ▶"}
          </button>
          {unlocked && (
            <div className="unlock-burst" aria-hidden="true">
              <PixelIcon name="key-gold" size={56} />
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
