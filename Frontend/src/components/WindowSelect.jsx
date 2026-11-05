import { useEffect } from "react";
import { useApi } from "../lib/hooks";
import { windowStatus } from "../lib/format";

// Dropdown of voting windows (staff). Empty value = "current" (backend picks open/latest).
export default function WindowSelect({ value, onChange, onLoaded, allowAll = false, allLabel = "All windows" }) {
  const { data } = useApi("/staff/windows");

  useEffect(() => {
    if (data) onLoaded?.(data);
  }, [data, onLoaded]);

  // Default to the open (or most recent) window when "all" isn't an option
  useEffect(() => {
    if (!allowAll && !value && data?.length) {
      const open = data.find((w) => windowStatus(w).key === "open");
      onChange((open || data[0]).id);
    }
  }, [allowAll, value, data, onChange]);

  return (
    <select className="select" value={value || ""} onChange={(e) => onChange(e.target.value)} aria-label="Voting window">
      {allowAll && <option value="">{allLabel}</option>}
      {!allowAll && !data?.length && <option value="">No windows</option>}
      {data?.map((w) => (
        <option key={w.id} value={w.id}>
          {w.title} · {windowStatus(w).label}
        </option>
      ))}
    </select>
  );
}
