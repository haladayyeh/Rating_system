import { useEffect } from "react";
import { useNow } from "../lib/hooks";
import { splitDuration } from "../lib/format";

export default function Countdown({ to, onDone }) {
  const now = useNow(1000);
  const ms = new Date(to).getTime() - now;
  const done = ms <= 0;

  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

  if (done) return <span className="countdown-done">Closed</span>;

  const { d, h, m, s } = splitDuration(ms);
  const parts = [
    ["days", d],
    ["hrs", h],
    ["min", m],
    ["sec", s],
  ];
  return (
    <div className="countdown" aria-label={`${d} days ${h} hours ${m} minutes left`}>
      {parts.map(([k, v]) => (
        <div key={k} className="countdown-cell">
          <span className="countdown-num">{String(v).padStart(2, "0")}</span>
          <span className="countdown-unit">{k}</span>
        </div>
      ))}
    </div>
  );
}
