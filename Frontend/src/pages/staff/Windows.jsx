import { useState } from "react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { formatDate, fromLocalInput, toLocalInput, windowStatus } from "../../lib/format";
import { useToast } from "../../lib/toast";
import { Empty, ErrorBox, Modal, PageHeader, Spinner, Toggle } from "../../components/ui";

function defaults() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3 * 86400000);
  return { title: "", startsAt: start.toISOString(), endsAt: end.toISOString(), minVotes: 2, maxVotes: 5 };
}

export default function Windows() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi("/staff/windows");
  const [editing, setEditing] = useState(null); // null | "new" | window

  async function toggleActive(w, isActive) {
    try {
      await api(`/staff/windows/${w.id}`, { method: "PATCH", body: { isActive } });
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Voting windows">
        <button className="btn btn-primary" onClick={() => setEditing("new")}>+ New window</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty icon="clock" title="No voting windows yet">Create one to let students start rating.</Empty>
      ) : (
        <ul className="windows">
          {data.map((w) => {
            const st = windowStatus(w);
            return (
              <li key={w.id} className={`window card window-${st.key}`}>
                <div className="window-main">
                  <span className={`status-pill status-${st.key}`}>{st.label}</span>
                  <h3>{w.title}</h3>
                  <p className="muted small">{formatDate(w.startsAt)} → {formatDate(w.endsAt)}</p>
                </div>
                <div className="window-votes">
                  <span className="mono">{w.minVotes}–{w.maxVotes}</span>
                  <small className="muted">votes / student</small>
                </div>
                <div className="window-actions">
                  <Toggle checked={w.isActive} onChange={(v) => toggleActive(w, v)} label="Active" />
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(w)}>Edit</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <WindowModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </>
  );
}

function WindowModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const base = initial || defaults();
  const [form, setForm] = useState({
    title: base.title,
    startsAt: toLocalInput(base.startsAt),
    endsAt: toLocalInput(base.endsAt),
    minVotes: base.minVotes,
    maxVotes: base.maxVotes,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const invalid =
    !form.startsAt || !form.endsAt || new Date(form.endsAt) <= new Date(form.startsAt) ||
    Number(form.minVotes) > Number(form.maxVotes) || Number(form.minVotes) < 0 || Number(form.maxVotes) < 1;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const body = {
      title: form.title.trim() || undefined,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      minVotes: Number(form.minVotes),
      maxVotes: Number(form.maxVotes),
    };
    try {
      if (initial) await api(`/staff/windows/${initial.id}`, { method: "PATCH", body });
      else await api("/staff/windows", { method: "POST", body });
      toast(initial ? "Window updated" : "Window created");
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? "Edit voting window" : "New voting window"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="window-form" disabled={invalid || busy}>{busy ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <form id="window-form" className="form-grid" onSubmit={submit}>
        <label className="field span-2">
          <span>Title</span>
          <input className="input" value={form.title} onChange={set("title")} placeholder="e.g. Week 3 voting" />
        </label>
        <label className="field">
          <span>Starts</span>
          <input className="input" type="datetime-local" required value={form.startsAt} onChange={set("startsAt")} />
        </label>
        <label className="field">
          <span>Ends</span>
          <input className="input" type="datetime-local" required value={form.endsAt} onChange={set("endsAt")} />
        </label>
        <label className="field">
          <span>Min votes</span>
          <input className="input" type="number" min={0} value={form.minVotes} onChange={set("minVotes")} />
        </label>
        <label className="field">
          <span>Max votes</span>
          <input className="input" type="number" min={1} value={form.maxVotes} onChange={set("maxVotes")} />
        </label>
      </form>
      {invalid && <p className="small text-warn">End must be after start, and min ≤ max.</p>}
      {error && <div className="alert alert-error">{error}</div>}
    </Modal>
  );
}
