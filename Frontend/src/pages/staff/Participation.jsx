import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/hooks";
import WindowSelect from "../../components/WindowSelect";
import { Avatar, Empty, ErrorBox, PageHeader, Spinner, Stat, Tabs } from "../../components/ui";

export default function Participation() {
  const [windowId, setWindowId] = useState("");
  const [tab, setTab] = useState("belowMinimum");
  const [noWindows, setNoWindows] = useState(false);
  const onLoaded = useCallback((list) => setNoWindows(list.length === 0), []);
  const { data, error, loading, reload } = useApi(windowId ? `/staff/windows/${windowId}/participation` : null);

  const list = data?.[tab] ?? [];

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Participation">
        <WindowSelect value={windowId} onChange={setWindowId} onLoaded={onLoaded} />
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {noWindows ? (
        <Empty icon="clock" title="No voting windows yet" />
      ) : (loading || !windowId) && !data ? (
        <Spinner />
      ) : data ? (
        <>
          <div className="stats-row">
            <Stat icon="check" label="Voted" value={data.voted.length} tone="good" />
            <Stat icon="heart-empty" label="Not voted" value={data.notVoted.length} />
            <Stat icon="arrow-down" label="Below minimum" value={data.belowMinimum.length} hint={`min ${data.minVotes} · max ${data.maxVotes}`} tone="warn" />
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "belowMinimum", label: "Below minimum", count: data.belowMinimum.length },
              { value: "notVoted", label: "Not voted", count: data.notVoted.length },
              { value: "voted", label: "Voted", count: data.voted.length },
            ]}
          />
          {list.length === 0 ? (
            <Empty icon="check" title="Nobody here" />
          ) : (
            <ul className="people-grid">
              {list.map((s) => (
                <li key={s.id} className="person">
                  <Avatar name={s.name} size={40} />
                  <div className="person-info">
                    <Link className="link-plain" to={`/staff/students/${s.id}`}><strong>{s.name}</strong></Link>
                    <span className="mono muted">@{s.login}</span>
                  </div>
                  {s.votesGiven !== undefined && (
                    <span className={`vote-count ${s.reachedMinimum ? "ok" : "low"}`}>
                      {s.votesGiven}/{data.maxVotes}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Empty icon="clock" title="No voting windows yet" />
      )}
    </>
  );
}
