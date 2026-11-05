import { useEffect, useRef } from "react";
import { initials } from "../lib/format";

export function Logo({ compact = false }) {
  return (
    <div className="logo">
      <span className="logo-mark">42</span>
      {!compact && (
        <span className="logo-text">
          <strong>Amman</strong>
          <small>Peer Rank</small>
        </span>
      )}
    </div>
  );
}

export function Avatar({ name, size = 40, highlight = false }) {
  return (
    <span
      className={`avatar ${highlight ? "avatar-hl" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      <span className="muted">{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error">
      <span>{error.message || String(error)}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ icon = "◇", title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

const SEVERITY_CLASS = {
  POSITIVE: "badge-pos",
  MINOR: "badge-minor",
  SERIOUS: "badge-serious",
  LOW: "badge-low",
  MEDIUM: "badge-minor",
  HIGH: "badge-serious",
  OPEN: "badge-open",
  CONFIRMED: "badge-serious",
  DISMISSED: "badge-muted",
};

export function Badge({ children, kind, className = "" }) {
  return <span className={`badge ${SEVERITY_CLASS[kind] || ""} ${className}`}>{children}</span>;
}

export function Stat({ label, value, hint, tone = "default" }) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Progress({ value, max, marker }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const markerPct = max && marker ? Math.min(100, (marker / max) * 100) : null;
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      {markerPct !== null && (
        <div className="progress-marker" style={{ left: `${markerPct}%` }} title={`Minimum: ${marker}`} />
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`toggle ${disabled ? "is-disabled" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={`tab ${value === t.value ? "is-active" : ""}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", autoFocus }) {
  return (
    <div className="search">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
    </div>
  );
}
