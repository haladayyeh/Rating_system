import { useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal } from "./ui";

export default function InvalidateModal({ ratingId, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api(`/staff/ratings/${ratingId}/invalidate`, { method: "POST", body: { reason: reason.trim() } });
      toast("Rating invalidated");
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Invalidate rating"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim() || busy} onClick={submit}>
            {busy ? "Invalidating…" : "Invalidate"}
          </button>
        </>
      }
    >
      <p className="muted">The rating stays in the history but no longer counts towards averages or the leaderboard.</p>
      <label className="field">
        <span>Reason</span>
        <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Confirmed revenge vote" />
      </label>
      {error && <div className="alert alert-error">{error}</div>}
    </Modal>
  );
}
