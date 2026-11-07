import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { avg, formatDate } from "../../lib/format";
import { useToast } from "../../lib/toast";
import { Stars } from "../../components/Stars";
import Podium from "../../components/Podium";
import { Avatar, Empty, ErrorBox, PageHeader, Spinner, Toggle } from "../../components/ui";
import NameBadge from "../../components/NameBadge";

export default function StaffLeaderboard() {
  const toast = useToast();
  const [windowId, setWindowId] = useState("");
  const { data, error, loading, reload } = useApi(`/staff/leaderboard${windowId ? `?windowId=${windowId}` : ""}`);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const w = data?.window;
  useEffect(() => {
    if (w) setForm({ shared: w.shared, topN: w.topN, showAverages: w.showAverages, title: w.leaderboardTitle });
  }, [w]);

  async function save(patch) {
    const body = patch || { ...form, topN: Number(form.topN), title: form.title.trim() };
    setBusy(true);
    try {
      await api(`/staff/leaderboard/${w.id}`, { method: "PATCH", body });
      toast(body.shared === undefined ? "Settings saved" : body.shared ? "Leaderboard shared with students" : "Leaderboard hidden from students");
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!w) return (<><PageHeader eyebrow="Staff console" title="Leaderboard" /><Empty icon="clock" title="No voting windows yet" /></>);

  const ranking = data.ranking;
  const dirty = form && (form.topN !== w.topN || form.showAverages !== w.showAverages || form.title !== w.leaderboardTitle);

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Leaderboard">
        <select className="select" value={w.id} onChange={(e) => setWindowId(e.target.value)} aria-label="Voting window">
          {data.windows.map((x) => (
            <option key={x.id} value={x.id}>{x.title}{x.shared ? " · shared" : ""}</option>
          ))}
        </select>
      </PageHeader>

      <div className="grid-board">
        <section className={`card share-card ${w.shared ? "is-shared" : ""}`}>
          <div className="share-status">
            <span className="share-dot" />
            <div>
              <strong>{w.shared ? "Visible to students" : "Hidden from students"}</strong>
              <div className="muted small">
                {w.shared && w.sharedAt ? `Shared ${formatDate(w.sharedAt)}` : "Only staff can see this ranking"}
              </div>
            </div>
            <button className={`btn ${w.shared ? "btn-ghost" : "btn-yellow"}`} disabled={busy} onClick={() => save({ shared: !w.shared })}>
              {w.shared ? "Unshare" : "Share with students"}
            </button>
          </div>

          {form && (
            <form className="share-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <label className="field">
                <span>Title shown to students</span>
                <input className="input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="field field-inline">
                <span>Show top</span>
                <input className="input input-num" type="number" min={1} max={100} value={form.topN}
                  onChange={(e) => setForm({ ...form, topN: e.target.value === "" ? "" : Number(e.target.value) })} />
                <span>students</span>
              </label>
              <Toggle checked={form.showAverages} onChange={(v) => setForm({ ...form, showAverages: v })} label="Show averages to students" />
              <button className="btn btn-primary" disabled={!dirty || busy || !form.title.trim() || !form.topN}>Save settings</button>
            </form>
          )}
        </section>

        <section className="board-main">
          <p className="muted small">
            Ranked by average stars (valid ratings only). Students need at least {data.minRatingsToRank} ratings to be ranked.
          </p>
          {ranking.length === 0 ? (
            <Empty icon="crown" title="No one ranked yet">Students appear once they have {data.minRatingsToRank}+ ratings.</Empty>
          ) : (
            <>
              <Podium entries={ranking} />
              <div className="table-wrap card">
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Student</th><th>Average</th><th className="num">Ratings</th></tr>
                  </thead>
                  <tbody>
                    {ranking.map((r) => (
                      <tr key={r.id} className={r.rank > w.topN ? "is-cut" : ""}>
                        <td className="mono"><span className={`rank-chip rank-${r.rank}`}>{r.rank}</span></td>
                        <td>
                          <div className="cell-person">
                            <Avatar name={r.name} size={30} />
                            <Link className="link-plain" to={`/staff/students/${r.id}`}>
                              <strong>{r.name}</strong> <NameBadge nickname={r.nickname} icon={r.nicknameIcon} size="sm" /> <span className="mono muted small">@{r.login}</span>
                            </Link>
                          </div>
                        </td>
                        <td><span className="cell-avg"><Stars value={r.average} size={14} /> <span className="mono">{avg(r.average)}</span></span></td>
                        <td className="num mono">{r.ratingsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ranking.length > w.topN && (
                <p className="muted small">Faded rows are below the top {w.topN} and won't be shown to students.</p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
