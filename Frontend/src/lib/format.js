export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";
}

export function formatDate(iso, withTime = true) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
  });
}

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// 3 → "3.0", 2.5 → "2.5", 2.666 → "2.67"
export function avg(n) {
  if (n === null || n === undefined) return "-";
  const x = Number(n);
  return Number.isInteger(x) ? x.toFixed(1) : x.toFixed(2).replace(/0$/, "");
}

// ISO → value for <input type="datetime-local">
export function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null;
}

export function windowStatus(w, now = Date.now()) {
  if (w.isActive === false) return { key: "inactive", label: "Disabled" };
  const s = new Date(w.startsAt).getTime();
  const e = new Date(w.endsAt).getTime();
  if (now < s) return { key: "upcoming", label: "Upcoming" };
  if (now > e) return { key: "ended", label: "Ended" };
  return { key: "open", label: "Open" };
}

export function splitDuration(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(t / 86400),
    h: Math.floor((t % 86400) / 3600),
    m: Math.floor((t % 3600) / 60),
    s: t % 60,
  };
}
