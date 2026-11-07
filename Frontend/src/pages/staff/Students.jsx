import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi, useDebounced } from "../../lib/hooks";
import { avg } from "../../lib/format";
import { Stars } from "../../components/Stars";
import { Avatar, Empty, ErrorBox, PageHeader, SearchInput, Spinner } from "../../components/ui";
import NameBadge from "../../components/NameBadge";

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  average: (a, b) => (b.average ?? -1) - (a.average ?? -1),
  ratingsReceived: (a, b) => b.ratingsReceived - a.ratingsReceived,
  votesGiven: (a, b) => b.votesGiven - a.votesGiven,
};

export default function Students() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(null);
  const dq = useDebounced(q.trim(), 250);
  const { data, error, loading, reload } = useApi(`/staff/students${dq ? `?q=${encodeURIComponent(dq)}` : ""}`);

  const rows = data ? (sort ? [...data].sort(SORTS[sort]) : data) : [];

  const Th = ({ k, children, className }) => (
    <th className={className}>
      <button className={`th-btn ${sort === k ? "is-sorted" : ""}`} onClick={() => setSort(sort === k ? null : k)}>
        {children} {sort === k ? "↓" : ""}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader eyebrow="Staff console" title="Students">
        <span className="muted">{data ? `${data.length} students` : ""}</span>
      </PageHeader>
      <SearchInput value={q} onChange={setQ} placeholder="Search by name or intra login…" />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty icon="question" title="No students found" />
      ) : (
        <div className="table-wrap card">
          <table className="table table-click">
            <thead>
              <tr>
                <Th k="name">Student</Th>
                <Th k="average">Average</Th>
                <Th k="ratingsReceived" className="num">Received</Th>
                <Th k="votesGiven" className="num">Given</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/staff/students/${s.id}`)} tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/staff/students/${s.id}`)}>
                  <td>
                    <div className="cell-person">
                      <Avatar name={s.name} size={34} />
                      <div>
                        <strong>{s.name}</strong> <NameBadge nickname={s.nickname} icon={s.nicknameIcon} size="sm" />
                        <div className="mono muted small">@{s.login}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {s.average !== null ? (
                      <span className="cell-avg"><Stars value={s.average} size={14} /> <span className="mono">{avg(s.average)}</span></span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="num mono">{s.ratingsReceived}</td>
                  <td className="num mono">{s.votesGiven}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
