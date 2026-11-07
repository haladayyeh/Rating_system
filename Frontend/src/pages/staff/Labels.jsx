import { useState } from "react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useToast } from "../../lib/toast";
import { Badge, Empty, ErrorBox, PageHeader, Spinner, Toggle } from "../../components/ui";
import LabelIcon from "../../components/LabelIcon";

const SEVERITIES = ["POSITIVE", "MINOR", "SERIOUS"];

export default function Labels() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi("/staff/labels");
  const [form, setForm] = useState({ name: "", allowedStars: [3], severity: "POSITIVE" });
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const label = await api("/staff/labels", { method: "POST", body: { ...form, name: form.name.trim() } });
      setData((d) => [...(d || []), label]);
      setForm({ ...form, name: "" });
      toast(`Label “${label.name}” created`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function patch(label, body) {
    try {
      const updated = await api(`/staff/labels/${label.id}`, { method: "PATCH", body });
      setData((d) => d.map((l) => (l.id === label.id ? updated : l)));
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function remove(label) {
    if (!window.confirm(`Delete label “${label.name}”?`)) return;
    try {
      const res = await api(`/staff/labels/${label.id}`, { method: "DELETE" });
      if (res.deleted) {
        setData((d) => d.filter((l) => l.id !== label.id));
        toast("Label deleted");
      } else {
        setData((d) => d.map((l) => (l.id === label.id ? { ...l, isActive: false } : l)));
        toast(res.message || "Label disabled", "info");
      }
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const toggleStar = (stars, n) => (stars.includes(n) ? stars.filter((s) => s !== n) : [...stars, n].sort());

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Labels" />

      <form className="card label-form" onSubmit={create}>
        <label className="field">
          <span>New label</span>
          <span className="label-input">
            <span className="label-slot"><LabelIcon name={form.name} severity={form.severity} size={22} /></span>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Great explainer" />
          </span>
        </label>
        <div className="field">
          <span>Allowed stars</span>
          <StarToggles value={form.allowedStars} onChange={(n) => setForm({ ...form, allowedStars: toggleStar(form.allowedStars, n) })} />
        </div>
        <label className="field">
          <span>Severity</span>
          <select className="select" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.allowedStars.length}>Add label</button>
      </form>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty icon="pin" title="No labels yet" />
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr><th>Label</th><th>Severity</th><th>Allowed stars</th><th>Active</th><th /></tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id} className={l.isActive ? "" : "is-cut"}>
                  <td>
                    <span className="label-name">
                      <span className="label-slot"><LabelIcon name={l.name} severity={l.severity} size={22} /></span>
                      <strong>{l.name}</strong>
                    </span>
                  </td>
                  <td>
                    <select className="select select-sm" value={l.severity} onChange={(e) => patch(l, { severity: e.target.value })} aria-label="Severity">
                      {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                    </select>{" "}
                    <Badge kind={l.severity}>●</Badge>
                  </td>
                  <td>
                    <StarToggles
                      value={l.allowedStars}
                      onChange={(n) => {
                        const next = toggleStar(l.allowedStars, n);
                        if (next.length) patch(l, { allowedStars: next });
                      }}
                    />
                  </td>
                  <td><Toggle checked={l.isActive} onChange={(v) => patch(l, { isActive: v })} /></td>
                  <td className="num"><button className="btn btn-ghost btn-sm" onClick={() => remove(l)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StarToggles({ value, onChange }) {
  return (
    <div className="star-toggles">
      {[1, 2, 3].map((n) => (
        <button key={n} type="button" className={`star-toggle ${value.includes(n) ? "is-on" : ""}`} aria-pressed={value.includes(n)} onClick={() => onChange(n)}>
          {n}★
        </button>
      ))}
    </div>
  );
}
