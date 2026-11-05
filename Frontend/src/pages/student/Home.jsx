import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/hooks";
import { avg, formatDate } from "../../lib/format";
import { Stars } from "../../components/Stars";
import Countdown from "../../components/Countdown";
import { ErrorBox, PageHeader, Progress, Spinner } from "../../components/ui";

export default function StudentHome() {
  const { user } = useAuth();
  const rating = useApi("/me/rating");
  const votes = useApi("/me/votes");
  const win = useApi("/windows/current");
  const board = useApi("/leaderboard");

  const loading = rating.loading || votes.loading || win.loading;
  const error = rating.error || votes.error || win.error;
  const reloadAll = () => { rating.reload(); votes.reload(); win.reload(); };

  const firstName = user.name.split(" ")[0];
  const v = votes.data;
  const w = win.data;

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Hey ${firstName} 👋`} />
      <ErrorBox error={error} onRetry={reloadAll} />
      {loading && !error ? (
        <Spinner />
      ) : (
        <div className="grid-home">
          <section className={`card card-hero ${w?.isOpen ? "" : "is-closed"}`}>
            {w?.isOpen ? (
              <>
                <p className="eyebrow eyebrow-light">{w.title || "Voting window"} · open</p>
                <h2>Voting closes in</h2>
                <Countdown to={w.endsAt} onDone={reloadAll} />
                <p className="hero-sub">Ends {formatDate(w.endsAt)}</p>
                <Link to="/rate" className="btn btn-yellow">
                  Rate your peers →
                </Link>
              </>
            ) : (
              <>
                <p className="eyebrow eyebrow-light">Voting window</p>
                <h2>Voting is closed</h2>
                <p className="hero-sub">You'll be able to rate peers when staff opens the next window.</p>
              </>
            )}
          </section>

          <section className="card">
            <p className="eyebrow">My rating</p>
            {rating.data?.visible ? (
              <div className="my-rating">
                <span className="my-rating-num">{avg(rating.data.average)}</span>
                <span className="muted">/ 3</span>
                <Stars value={rating.data.average} size={26} />
              </div>
            ) : (
              <div className="my-rating-hidden">
                <Stars value={0} size={26} />
                <p className="muted">{rating.data?.message || "Not enough ratings yet."}</p>
              </div>
            )}
            <p className="fine">Only your average is shown — never who rated you or which labels.</p>
          </section>

          <section className="card">
            <p className="eyebrow">My votes</p>
            {v && v.max > 0 ? (
              <>
                <div className="votes-line">
                  <span className="votes-big">{v.used}</span>
                  <span className="muted">of {v.max} used</span>
                </div>
                <Progress value={v.used} max={v.max} marker={v.min} />
                <p className="fine">
                  {v.used < v.min ? (
                    <>
                      <strong className="text-warn">Rate at least {v.min - v.used} more</strong> to reach the minimum of {v.min}.
                    </>
                  ) : v.remaining > 0 ? (
                    <>Minimum reached ✓ — {v.remaining} vote{v.remaining === 1 ? "" : "s"} left.</>
                  ) : (
                    <>All votes used. Thanks for participating!</>
                  )}
                </p>
              </>
            ) : (
              <p className="muted">No open voting window.</p>
            )}
          </section>

          <section className="card">
            <div className="card-row">
              <p className="eyebrow">Top students</p>
              <Link to="/leaderboard" className="link">See all</Link>
            </div>
            {board.data?.shared ? (
              <ol className="mini-board">
                {board.data.entries.slice(0, 3).map((e) => (
                  <li key={e.rank} className={e.isMe ? "is-me" : ""}>
                    <span className={`rank-chip rank-${e.rank}`}>{e.rank}</span>
                    <span className="mini-name">{e.name}{e.isMe && " (you)"}</span>
                    {board.data.showAverages && <span className="mono">{avg(e.average)}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Staff hasn't shared the leaderboard yet.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
