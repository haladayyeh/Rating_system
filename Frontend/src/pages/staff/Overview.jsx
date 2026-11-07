import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { download } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { formatDate } from "../../lib/format";
import { useToast } from "../../lib/toast";
import Countdown from "../../components/Countdown";
import WindowSelect from "../../components/WindowSelect";
import { Empty, ErrorBox, PageHeader, Progress, Spinner, Stat } from "../../components/ui";

export function ExportButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await download("/staff/export.csv", "ratings.csv");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className="btn btn-ghost" onClick={run} disabled={busy}>
      {busy ? "Exporting…" : "⤓ Export CSV"}
    </button>
  );
}

export default function Overview() {
  const [windowId, setWindowId] = useState("");
  const [noWindows, setNoWindows] = useState(false);
  const onLoaded = useCallback((list) => setNoWindows(list.length === 0), []);
  const { data, error, loading, reload } = useApi(windowId ? `/staff/overview?windowId=${windowId}` : null);

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Overview">
        <WindowSelect value={windowId} onChange={setWindowId} onLoaded={onLoaded} />
        <ExportButton />
      </PageHeader>

      <ErrorBox error={error} onRetry={reload} />
      {noWindows ? (
        <Empty icon="clock" title="No voting windows yet"><Link className="link" to="/staff/windows">Create the first one →</Link></Empty>
      ) : loading || !windowId ? (
        <Spinner />
      ) : data?.window ? (
        <OverviewBody d={data} />
      ) : (
        <Empty icon="clock" title="No data for this window" />
      )}
    </>
  );
}

function OverviewBody({ d }) {
  const w = d.window;
  const isOpen = new Date(w.startsAt) <= new Date() && new Date() <= new Date(w.endsAt);
  const participation = d.totalStudents ? Math.round((d.studentsWhoRated / d.totalStudents) * 100) : 0;

  return (
    <div className="grid-overview">
      <section className="card card-hero">
        <p className="eyebrow eyebrow-light">{w.title}</p>
        {isOpen ? (
          <>
            <h2>Closes in</h2>
            <Countdown to={w.endsAt} />
          </>
        ) : (
          <h2>{new Date() < new Date(w.startsAt) ? "Not started yet" : "Closed"}</h2>
        )}
        <p className="hero-sub">
          {formatDate(w.startsAt)} → {formatDate(w.endsAt)} · {w.minVotes}–{w.maxVotes} votes per student
        </p>
      </section>

      <section className="card">
        <p className="eyebrow">Participation</p>
        <div className="big-pct">
          {participation}
          <span>%</span>
        </div>
        <Progress value={d.studentsWhoRated} max={d.totalStudents} />
        <p className="fine">
          {d.studentsWhoRated} of {d.totalStudents} students have voted ·{" "}
          <Link className="link" to="/staff/participation">details</Link>
        </p>
      </section>

      <div className="stats-row">
        <Stat icon="star-gold" label="Ratings" value={d.totalRatings} hint={d.invalidatedRatings ? `${d.invalidatedRatings} invalidated` : "valid ratings"} />
        <Stat icon="heart-empty" label="Didn't vote" value={d.studentsWhoDidNotRate} hint="no votes yet" />
        <Stat icon="arrow-down" label="Below minimum" value={d.studentsBelowMinimum} hint={`< ${w.minVotes} votes`} tone={d.studentsBelowMinimum ? "warn" : "default"} />
        <Link to="/staff/abuse" className="stat-link">
          <Stat icon="skull" label="Open abuse cases" value={d.openAbuseCases} hint="review now →" tone={d.openAbuseCases ? "danger" : "default"} />
        </Link>
      </div>
    </div>
  );
}
