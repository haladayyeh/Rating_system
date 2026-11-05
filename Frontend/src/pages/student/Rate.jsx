import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useApi, useDebounced } from "../../lib/hooks";
import { useToast } from "../../lib/toast";
import { StarPicker, STAR_MEANING } from "../../components/Stars";
import { Avatar, Badge, Empty, ErrorBox, Modal, PageHeader, Progress, SearchInput, Spinner } from "../../components/ui";

export default function Rate() {
  const win = useApi("/windows/current");
  const votes = useApi("/me/votes");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);
  // Under 2 chars the API rejects q, so we list everyone instead
  const path = dq.length >= 2 ? `/students?q=${encodeURIComponent(dq)}` : "/students";
  const students = useApi(win.data?.isOpen ? path : null);
  const [target, setTarget] = useState(null);

  if (win.loading) return <Spinner />;
  if (win.error) return <ErrorBox error={win.error} onRetry={win.reload} />;

  if (!win.data?.isOpen) {
    return (
      <>
        <PageHeader eyebrow="Rate peers" title="Voting is closed" />
        <Empty icon="◷" title="No open voting window">
          Come back when staff opens the next one.
        </Empty>
      </>
    );
  }

  const v = votes.data;
  const outOfVotes = v && v.remaining <= 0;

  function onRated(student, remaining) {
    students.setData((list) => list?.map((s) => (s.id === student.id ? { ...s, alreadyRated: true } : s)));
    votes.setData((old) => old && { ...old, used: old.max - remaining, remaining });
    setTarget(null);
  }

  return (
    <>
      <PageHeader eyebrow="Rate peers" title="Who did you work with?">
        {v && (
          <div className="votes-pill">
            <strong>{v.remaining}</strong> vote{v.remaining === 1 ? "" : "s"} left
            <Progress value={v.used} max={v.max} marker={v.min} />
          </div>
        )}
      </PageHeader>

      {outOfVotes && <div className="alert alert-info">You've used all your votes for this window. 🎉</div>}

      <SearchInput value={q} onChange={setQ} placeholder="Search by name or intra login…" autoFocus />

      <ErrorBox error={students.error} onRetry={students.reload} />
      {students.loading && !students.data ? (
        <Spinner />
      ) : students.data?.length === 0 ? (
        <Empty icon="⌕" title="No students found">Try another name or login.</Empty>
      ) : (
        <ul className={`people-grid ${students.loading ? "is-stale" : ""}`}>
          {students.data?.map((s) => (
            <li key={s.id} className={`person ${s.alreadyRated ? "is-done" : ""}`}>
              <Avatar name={s.name} size={44} />
              <div className="person-info">
                <strong>{s.name}</strong>
                <span className="mono muted">@{s.login}</span>
              </div>
              {s.alreadyRated ? (
                <Badge kind="POSITIVE">Rated ✓</Badge>
              ) : (
                <button className="btn btn-primary btn-sm" disabled={outOfVotes} onClick={() => setTarget(s)}>
                  Rate
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {target && <RateModal student={target} onClose={() => setTarget(null)} onRated={onRated} />}
    </>
  );
}

function RateModal({ student, onClose, onRated }) {
  const toast = useToast();
  const [stars, setStars] = useState(null);
  const [labels, setLabels] = useState(null);
  const [picked, setPicked] = useState([]);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!stars) return;
    let live = true;
    setLabels(null);
    setPicked([]);
    api(`/labels?stars=${stars}`)
      .then((l) => live && setLabels(l))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [stars]);

  const hasSerious = labels?.some((l) => picked.includes(l.id) && l.severity === "SERIOUS");
  const explanationOk = !hasSerious || explanation.trim().length >= 10;
  const canSubmit = stars && picked.length > 0 && explanationOk && !busy;

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await api("/ratings", {
        method: "POST",
        body: {
          rateeId: student.id,
          stars,
          labelIds: picked,
          ...(explanation.trim() ? { explanation: explanation.trim() } : {}),
        },
      });
      toast(`Rating for ${student.name} submitted`);
      onRated(student, res.remaining);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Rate ${student.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            {busy ? "Submitting…" : "Submit rating"}
          </button>
        </>
      }
    >
      <div className="modal-person">
        <Avatar name={student.name} size={48} />
        <div>
          <strong>{student.name}</strong>
          <div className="mono muted">@{student.login}</div>
        </div>
      </div>

      <h3 className="step-title"><span className="step-num">1</span> How was it?</h3>
      <StarPicker value={stars} onChange={setStars} />

      {stars && (
        <>
          <h3 className="step-title">
            <span className="step-num">2</span> Why {STAR_MEANING[stars].title.toLowerCase()}?
            <small className="muted"> pick at least one</small>
          </h3>
          {!labels ? (
            <Spinner label="Loading labels…" />
          ) : labels.length === 0 ? (
            <p className="muted">No labels configured for this rating.</p>
          ) : (
            <div className="chips">
              {labels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`chip chip-${l.severity.toLowerCase()} ${picked.includes(l.id) ? "is-on" : ""}`}
                  aria-pressed={picked.includes(l.id)}
                  onClick={() => toggle(l.id)}
                >
                  {l.name}
                  {l.severity === "SERIOUS" && <span className="chip-flag">serious</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {hasSerious && (
        <label className="field">
          <span>
            <span className="step-num step-num-warn">3</span> Explain what happened <small className="muted">(required, min. 10 characters — only staff see this)</small>
          </span>
          <textarea
            className="input"
            rows={3}
            maxLength={1000}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Describe the situation factually…"
          />
          <small className={explanationOk ? "muted" : "text-warn"}>{explanation.trim().length}/10</small>
        </label>
      )}

      {error && <div className="alert alert-error">{error}</div>}
    </Modal>
  );
}
