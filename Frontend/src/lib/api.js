// Small fetch wrapper: adds the token, parses JSON, and turns errors into readable messages.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") + "/api";
const TOKEN_KEY = "rank_token";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t) => {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

export async function api(path, { method = "GET", body, raw = false } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", 0, null);
  }

  if (raw && res.ok) return res;

  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }

  // A success status without JSON means something other than our API answered
  // (e.g. a different app running on the backend's port)
  if (res.ok && data === null && res.status !== 204) {
    throw new ApiError(
      "Got an unexpected response from the server, another app may be using the backend's port. Check the backend logs.",
      res.status,
      null
    );
  }

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login" && onUnauthorized) onUnauthorized();
    let message = data?.error || `Request failed (${res.status})`;
    if (res.status === 429 && data?.retryAfterSeconds) {
      message += `, try again in ${formatSeconds(data.retryAfterSeconds)}.`;
    }
    throw new ApiError(message, res.status, data);
  }
  return data;
}

function formatSeconds(s) {
  if (s < 60) return `${s}s`;
  return `${Math.ceil(s / 60)} min`;
}

// Downloads a file from an authenticated endpoint (e.g. the CSV export)
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
