import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useApi } from "../../lib/hooks";
import { useState } from "react";
import { avg, formatDate } from "../../lib/format";
import { Stars } from "../../components/Stars";
import Countdown from "../../components/Countdown";
import PixelIcon from "../../components/PixelIcon";
import { ErrorBox, PageHeader, Progress, Spinner } from "../../components/ui";
import NameBadge, { BadgeEditor } from "../../components/NameBadge";

export default function StudentHome() {
  const { user } = useAuth();
  const rating = useApi("/me/rating");
  const votes = useApi("/me/votes");
  const win = useApi("/windows/current");
  const board = useApi("/leaderboard");
  const [editingBadge, setEditingBadge] = useState(false);

  const loading = rating.loading || votes.loading || win.loading;
  const error = rating.error || votes.error || win.error;
  const reloadAll = () => { rating.reload(); votes.reload(); win.reload(); };

  const firstName = user.name.split(" ")[0];
  const v = votes.data;
  const w = win.data;

  return (
    <>
      <PageHeader eyebrow="42 Amman" title={`Hello ${firstName}!`}>
        {user.nickname ? (
          <button type="button" className="badge-btn" onClick={() => setEditingBadge(true)} title="Edit your name badge">
            <NameBadge nickname={user.nickname} icon={user.nicknameIcon} />
            <span className="muted small">Edit</span>
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingBadge(true)}>
            <PixelIcon name="medal" size={16} /> Add a name badge
          </button>
        )}
      </PageHeader>
      {editingBadge && <BadgeEditor onClose={() => setEditingBadge(false)} />}
      <ErrorBox error={error} onRetry={reloadAll} />
      {board.data?.shared && <LeaderboardAnnouncement board={board.data} />}
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
            <p className="eyebrow eyebrow-icon"><PixelIcon name="star-gold" size={18} />My rating</p>
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
          </section>

          <section className="card">
            <p className="eyebrow eyebrow-icon"><PixelIcon name="coin" size={18} />My votes</p>
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
                    <><PixelIcon name="check" size={14} className="inline-icon" /> Minimum reached, {v.remaining} vote{v.remaining === 1 ? "" : "s"} left.</>
                  ) : (
                    <><PixelIcon name="trophy" size={14} className="inline-icon" /> All votes used. Thanks for participating!</>
                  )}
                </p>
              </>
            ) : (
              <p className="muted">No open voting window.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

// Shows up only after staff shares the leaderboard
function LeaderboardAnnouncement({ board }) {
  const top = board.entries.slice(0, 3);
  return (
    <Link to="/leaderboard" className="announce">
      <span className="announce-stars" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <PixelIcon key={i} name="star-gold" size={i === 1 ? 40 : 32} style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </span>
      <div className="announce-text">
        <p className="eyebrow eyebrow-light">Just announced · {board.windowTitle}</p>
        <h2>{board.title}</h2>
        {top.length > 0 && (
          <ol className="announce-top">
            {top.map((e) => (
              <li key={e.rank} className={e.isMe ? "is-me" : ""}>
                <span className={`rank-chip rank-${e.rank}`}>{e.rank}</span>
                {e.name}{e.isMe && " (you)"} <NameBadge nickname={e.nickname} icon={e.nicknameIcon} size="sm" />
              </li>
            ))}
          </ol>
        )}
      </div>
      <span className="btn btn-yellow announce-cta">See the leaderboard →</span>
    </Link>
  );
}
