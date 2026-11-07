import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../lib/hooks";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { avg, formatDate } from "../../lib/format";
import { Stars } from "../../components/Stars";
import InvalidateModal from "../../components/InvalidateModal";
import { Avatar, Badge, Empty, ErrorBox, Spinner, Stat, Tabs } from "../../components/ui";
import LabelIcon from "../../components/LabelIcon";
import NameBadge from "../../components/NameBadge";

export default function StudentDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/staff/students/${id}`);
  const [tab, setTab] = useState("received");
  const [invalidating, setInvalidating] = useState(null);
  const [clearing, setClearing] = useState(false);
  const toast = useToast();

  async function clearNickname() {
    if (!window.confirm(`Remove the badge "${data.student.nickname}" from ${data.student.name}?`)) return;
    setClearing(true);
    try {
      await api(`/staff/students/${id}/nickname`, { method: "DELETE" });
      toast("Badge removed");
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setClearing(false);
    }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <><Link to="/staff/students" className="link back">← Students</Link><ErrorBox error={error} onRetry={reload} /></>;

  const { student, received, given, labelsReceived } = data;
  const rows = tab === "received" ? received : given;

  return (
    <>
      <Link to="/staff/students" className="link back">← Students</Link>
      <section className="profile card">
        <Avatar name={student.name} size={72} />
        <div className="profile-info">
          <h1>{student.name}</h1>
          <span className="mono muted">@{student.login}</span>
          {student.nickname && (
            <div className="profile-badge">
              <NameBadge nickname={student.nickname} icon={student.nicknameIcon} />
              <button className="btn btn-ghost btn-sm" disabled={clearing} onClick={clearNickname}>
                Remove badge
              </button>
            </div>
          )}
        </div>
        <div className="profile-stats">
          <Stat label="Average" value={student.average !== null ? avg(student.average) : "-"} hint={<Stars value={student.average} size={14} />} />
          <Stat label="Received" value={received.length} />
          <Stat label="Given" value={given.length} />
        </div>
      </section>

      {labelsReceived.length > 0 && (
        <section className="card">
          <p className="eyebrow">Labels received</p>
          <div className="chips">
            {labelsReceived.map((l) => (
              <span key={l.name} className={`chip chip-static chip-${(l.severity || "minor").toLowerCase()}`}>
                <LabelIcon name={l.name} severity={l.severity} size={18} />
                {l.name} <span className="chip-count">{l.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "received", label: "Received", count: received.length },
          { value: "given", label: "Given", count: given.length },
        ]}
      />

      {rows.length === 0 ? (
        <Empty icon="heart-empty" title={`No ratings ${tab} yet`} />
      ) : (
        <ul className="rating-list">
          {rows.map((r) => (
            <li key={r.id} className={`rating-item card ${r.is_invalidated ? "is-invalid" : ""}`}>
              <div className="rating-head">
                <Stars value={r.stars} size={16} />
                <span>
                  {tab === "received" ? "from " : "to "}
                  <strong>{tab === "received" ? r.raterName : r.rateeName}</strong>{" "}
                  <span className="mono muted small">@{tab === "received" ? r.raterLogin : r.rateeLogin}</span>
                </span>
                <span className="muted small rating-date">{formatDate(r.created_at)}</span>
              </div>
              <div className="chips">
                {r.labels.map((l) => (
                  <Badge key={l.name} kind={l.severity}><LabelIcon name={l.name} severity={l.severity} size={14} />{l.name}</Badge>
                ))}
              </div>
              {r.explanation && <blockquote className="explanation">{r.explanation}</blockquote>}
              <div className="rating-foot">
                {r.is_invalidated ? (
                  <span className="text-danger small">Invalidated: {r.invalidated_reason}</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setInvalidating(r.id)}>Invalidate</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {invalidating && (
        <InvalidateModal
          ratingId={invalidating}
          onClose={() => setInvalidating(null)}
          onDone={() => { setInvalidating(null); reload(); }}
        />
      )}
    </>
  );
}
