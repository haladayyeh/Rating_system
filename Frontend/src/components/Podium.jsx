import { avg } from "../lib/format";
import { Avatar } from "./ui";
import PixelIcon from "./PixelIcon";
import NameBadge from "./NameBadge";

// Top-3 podium. entries: [{ rank, name, average?, isMe? }]
export default function Podium({ entries, showAverages = true }) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;
  // Visual order: 2nd, 1st, 3rd
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <div className="podium">
      {order.map((e) => (
        <div key={e.rank} className={`podium-col podium-${e.rank} ${e.isMe ? "is-me" : ""}`}>
          {e.rank === 1 && <PixelIcon name="crown" size={34} className="crown" />}
          <Avatar name={e.name} size={e.rank === 1 ? 72 : 56} highlight={e.rank === 1} />
          <strong className="podium-name">{e.name}{e.isMe && <em> (you)</em>}</strong>
          <NameBadge nickname={e.nickname} icon={e.nicknameIcon} size="sm" />
          {showAverages && e.average !== undefined && <span className="podium-avg mono">★ {avg(e.average)}</span>}
          <div className="podium-block">
            <span>{e.rank}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
