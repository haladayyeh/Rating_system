import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/hooks";
import { formatDate } from "../../lib/format";
import { Stars } from "../../components/Stars";
import InvalidateModal from "../../components/InvalidateModal";
import WindowSelect from "../../components/WindowSelect";
import { Badge, Empty, ErrorBox, PageHeader, Spinner, Tabs } from "../../components/ui";

export default function Ratings() {
  const [groupBy, setGroupBy] = useState("label");
  const [windowId, setWindowId] = useState("");
  const [openGroup, setOpenGroup] = useState(null);
  const [invalidating, setInvalidating] = useState(null);

  const params = new URLSearchParams();
  if (groupBy) params.set("groupBy", groupBy);
  if (windowId) params.set("windowId", windowId);
  const { data, error, loading, reload } = useApi(`/staff/ratings?${params}`);

  // While switching tabs, `data` can still be the previous tab's result for a moment
  // (grouped vs. plain list). Only draw it when its shape matches the selected tab.
  const isGroupedData = data?.length ? "group" in data[0] : Boolean(groupBy);
  const dataMatchesTab = isGroupedData === Boolean(groupBy);

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Ratings">
        <WindowSelect value={windowId} onChange={setWindowId} allowAll />
      </PageHeader>
      <Tabs
        value={groupBy}
        onChange={(v) => { setGroupBy(v); setOpenGroup(null); }}
        tabs={[
          { value: "label", label: "By label" },
          { value: "stars", label: "By stars" },
          { value: "student", label: "By student" },
          { value: "", label: "All" },
        ]}
      />
      <ErrorBox error={error} onRetry={reload} />
      {(loading && !data) || !dataMatchesTab ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty icon="★" title="No ratings yet" />
      ) : groupBy ? (
        <div className="groups">
          {data.map((g) => {
            const isOpen = openGroup === g.group;
            const max = data[0].count;
            return (
              <section key={g.group} className={`group card ${isOpen ? "is-open" : ""}`}>
                <button className="group-head" onClick={() => setOpenGroup(isOpen ? null : g.group)} aria-expanded={isOpen}>
                  <span className="group-name">{groupBy === "student" ? `@${g.group}` : g.group}</span>
                  <span className="group-bar"><span style={{ width: `${(g.count / max) * 100}%` }} /></span>
                  <span className="mono group-count">{g.count}</span>
                  <span className="chev">{isOpen ? "▴" : "▾"}</span>
                </button>
                {isOpen && <RatingTable ratings={g.ratings} onInvalidate={setInvalidating} />}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card"><RatingTable ratings={data} onInvalidate={setInvalidating} /></div>
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

function RatingTable({ ratings, onInvalidate }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Stars</th>
            <th>Labels</th>
            <th>When</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ratings.map((r) => (
            <tr key={r.ratingId} className={r.invalidated ? "is-invalid" : ""}>
              <td><Link className="link mono" to={`/staff/students/${r.from.id}`}>@{r.from.login}</Link></td>
              <td><Link className="link mono" to={`/staff/students/${r.to.id}`}>@{r.to.login}</Link></td>
              <td><Stars value={r.stars} size={14} /></td>
              <td>
                <div className="chips chips-tight">
                  {r.labels.map((l) => <Badge key={l}>{l}</Badge>)}
                </div>
                {r.explanation && <div className="small muted explanation-inline">“{r.explanation}”</div>}
              </td>
              <td className="small muted nowrap">{formatDate(r.createdAt)}</td>
              <td className="nowrap">
                {r.invalidated ? (
                  <span className="small text-danger" title={r.invalidatedReason}>Invalidated</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => onInvalidate(r.ratingId)}>Invalidate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
