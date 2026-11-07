import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { formatDate, timeAgo } from "../../lib/format";
import { useToast } from "../../lib/toast";
import { Stars } from "../../components/Stars";
import WindowSelect from "../../components/WindowSelect";
import PixelIcon from "../../components/PixelIcon";
import { Badge, Empty, ErrorBox, Modal, PageHeader, Spinner, Tabs } from "../../components/ui";
import LabelIcon from "../../components/LabelIcon";

// One pixel icon per kind of abuse
const TYPE_ICON = {
  BULK: "envelope",          // a pile of votes dumped at once
  REPEATED: "key-silver",    // trying the lock again and again
  GROUP: "helmet",           // a coordinated squad
  REVENGE: "sword",          // retaliation
  FRIENDS_BOOST: "potion-teal", // an unfair power-up
  TOO_FAST: "fire",          // blazing through votes
  EXTREME_VOTER: "bomb",     // only ever 1★ or 3★
  MALICIOUS_SERIOUS: "skull",
};

export default function Abuse() {
  const [windowId, setWindowId] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [confirming, setConfirming] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi(windowId ? `/staff/abuse?windowId=${windowId}` : null);

  const counts = { OPEN: 0, CONFIRMED: 0, DISMISSED: 0 };
  data?.forEach((c) => counts[c.status]++);
  const list = data?.filter((c) => !status || c.status === status) ?? [];

  async function dismiss(c) {
    try {
      await api(`/staff/abuse/${c.id}/dismiss`, { method: "POST" });
      setData((d) => d.map((x) => (x.id === c.id ? { ...x, status: "DISMISSED" } : x)));
      toast("Case dismissed");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Abuse cases">
        <WindowSelect value={windowId} onChange={setWindowId} />
      </PageHeader>
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { value: "OPEN", label: "Open", count: counts.OPEN },
          { value: "CONFIRMED", label: "Confirmed", count: counts.CONFIRMED },
          { value: "DISMISSED", label: "Dismissed", count: counts.DISMISSED },
          { value: "", label: "All", count: data?.length ?? 0 },
        ]}
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Spinner label="Running detection…" />
      ) : list.length === 0 ? (
        <Empty icon={status === "OPEN" ? "shield" : "question"} title={status === "OPEN" ? "No open cases" : "Nothing here"}>
          {status === "OPEN" && "Detection runs every time this page loads."}
        </Empty>
      ) : (
        <ul className="cases">
          {list.map((c) => (
            <li key={c.id} className={`case card case-${c.severity.toLowerCase()} case-${c.status.toLowerCase()}`}>
              <div className="case-icon" title={c.title}>
                <PixelIcon name={TYPE_ICON[c.type] || "exclamation"} size={36} />
              </div>
              <div className="case-body">
                <div className="case-top">
                  <h3>{c.title}</h3>
                  <Badge kind={c.severity}>{c.severity}</Badge>
                  {c.status !== "OPEN" && <Badge kind={c.status}>{c.status}</Badge>}
                  <span className="muted small case-time" title={formatDate(c.detectedAt)}>{timeAgo(c.detectedAt)}</span>
                </div>
                <p>{c.summary}</p>
                <div className="case-students">
                  {c.students.map((s) => (
                    <Link key={s.id} to={`/staff/students/${s.id}`} className="student-tag mono">@{s.login}</Link>
                  ))}
                  <button className="link small" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    {expanded === c.id ? "Hide" : "Show"} {c.ratingIds.length} rating{c.ratingIds.length === 1 ? "" : "s"}
                  </button>
                </div>
                {expanded === c.id && <CaseRatings id={c.id} />}
              </div>
              {c.status === "OPEN" && (
                <div className="case-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirming(c)}>Confirm</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => dismiss(c)}>Dismiss</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <ConfirmModal
          c={confirming}
          onClose={() => setConfirming(null)}
          onDone={(invalidated) => {
            setData((d) => d.map((x) => (x.id === confirming.id ? { ...x, status: "CONFIRMED" } : x)));
            toast(`Case confirmed${invalidated ? ` · ${invalidated} rating${invalidated === 1 ? "" : "s"} invalidated` : ""}`);
            setConfirming(null);
          }}
        />
      )}
    </>
  );
}

function CaseRatings({ id }) {
  const { data, error, loading } = useApi(`/staff/abuse/${id}`);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  return (
    <ul className="case-ratings">
      {data.ratings.map((r) => (
        <li key={r.id} className={r.invalidated ? "is-invalid" : ""}>
          <span><strong>{r.fromName}</strong> → <strong>{r.toName}</strong></span>
          <Stars value={r.stars} size={12} />
          <span className="case-labels small">
            {r.labels.map((l) => (
              <span key={l} className="case-label"><LabelIcon name={l} size={14} />{l}</span>
            ))}
          </span>
          <span className="muted small">{formatDate(r.createdAt)}</span>
          {r.explanation && <em className="small">“{r.explanation}”</em>}
        </li>
      ))}
    </ul>
  );
}

function ConfirmModal({ c, onClose, onDone }) {
  const [invalidate, setInvalidate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    try {
      const res = await api(`/staff/abuse/${c.id}/confirm`, { method: "POST", body: { invalidateRatings: invalidate } });
      onDone(res.invalidated);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Confirm abuse case"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={submit} disabled={busy}>{busy ? "Confirming…" : "Confirm case"}</button>
        </>
      }
    >
      <div className="confirm-case">
        <PixelIcon name={TYPE_ICON[c.type] || "exclamation"} size={36} />
        <p><strong>{c.title}</strong> - {c.summary}</p>
      </div>
      <label className="check">
        <input type="checkbox" checked={invalidate} onChange={(e) => setInvalidate(e.target.checked)} />
        Also invalidate the {c.ratingIds.length} rating{c.ratingIds.length === 1 ? "" : "s"} involved
      </label>
      {error && <div className="alert alert-error">{error}</div>}
    </Modal>
  );
}
