import { useApi } from "../../lib/hooks";
import { avg } from "../../lib/format";
import { Stars } from "../../components/Stars";
import Podium from "../../components/Podium";
import { Avatar, BackLink, Empty, ErrorBox, PageHeader, Spinner } from "../../components/ui";
import NameBadge from "../../components/NameBadge";

export default function StudentLeaderboard() {
  const { data, error, loading, reload } = useApi("/leaderboard");

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  if (!data?.shared) {
    return (
      <>
        <BackLink />
        <PageHeader eyebrow="Leaderboard" title="Top students" />
        <Empty icon="trophy" title="Not shared yet">
          Staff will publish the leaderboard when the voting window wraps up.
        </Empty>
      </>
    );
  }

  const rest = data.entries.slice(3);
  return (
    <>
      <BackLink />
      <PageHeader eyebrow={data.windowTitle} title={data.title} />
      {data.entries.length === 0 ? (
        <Empty icon="crown" title="No ranked students yet" />
      ) : (
        <>
          <Podium entries={data.entries} showAverages={data.showAverages} />
          {rest.length > 0 && (
            <ol className="board-list card">
              {rest.map((e) => (
                <li key={e.rank} className={e.isMe ? "is-me" : ""}>
                  <span className="board-rank mono">#{e.rank}</span>
                  <Avatar name={e.name} size={36} />
                  <span className="board-name">
                    {e.name}
                    {e.isMe && <em className="you-tag">you</em>}
                    <NameBadge nickname={e.nickname} icon={e.nicknameIcon} size="sm" />
                  </span>
                  {data.showAverages && (
                    <span className="board-avg">
                      <Stars value={e.average} size={14} />
                      <span className="mono">{avg(e.average)}</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}
