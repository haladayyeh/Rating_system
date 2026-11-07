import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import PixelIcon from "./PixelIcon";
import { Modal } from "./ui";

// Same list the backend accepts (Backend/src/routes/profile.js)
export const BADGE_ICONS = [
  "star-gold", "star-blue", "star-red", "star-teal", "crown", "trophy", "medal", "coin",
  "heart", "heart-half", "heart-empty", "crystal", "ruby", "pin", "key-gold", "key-silver",
  "sword", "magic-sword", "shield", "helmet", "arrow", "bomb", "fire", "flame", "skull",
  "potion-red", "potion-yellow", "potion-blue", "potion-teal", "gift", "envelope", "speech",
  "house", "clock", "drop", "snail", "check", "plus", "cross", "question", "exclamation",
  "arrow-up", "arrow-down",
];
export const NICK_MIN = 2;
export const NICK_MAX = 20;

// The little pixel badge shown next to someone's name. Renders nothing without a nickname.
export default function NameBadge({ nickname, icon, size = "md" }) {
  if (!nickname) return null;
  return (
    <span className={`nick-badge nick-${size}`} title={`Nickname: ${nickname}`}>
      <PixelIcon name={icon || "star-gold"} size={size === "sm" ? 12 : 14} />
      <span className="nick-text">{nickname}</span>
    </span>
  );
}

// Dialog to set / change / remove your own badge
export function BadgeEditor({ onClose }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [nickname, setNickname] = useState(user.nickname || "");
  const [icon, setIcon] = useState(user.nicknameIcon || "star-gold");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const len = [...nickname.trim()].length;
  const tooShort = len > 0 && len < NICK_MIN;
  const unchanged = nickname.trim() === (user.nickname || "") && (icon === (user.nicknameIcon || "star-gold") || !nickname.trim());

  async function save(value) {
    setBusy(true);
    setError("");
    try {
      const res = await api("/me/nickname", { method: "PATCH", body: { nickname: value, icon } });
      updateUser(res);
      toast(res.nickname ? "Badge saved" : "Badge removed");
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Your name badge"
      onClose={onClose}
      footer={
        <>
          {user.nickname && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => save(null)} style={{ marginRight: "auto" }}>
              Remove
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || tooShort || unchanged} onClick={() => save(nickname.trim() || null)}>
            {busy ? "Saving…" : "Save badge"}
          </button>
        </>
      }
    >
      <div className="badge-preview">
        <span className="muted small">Preview</span>
        <div className="badge-preview-name">
          <strong>{user.name}</strong>
          {nickname.trim() ? <NameBadge nickname={nickname.trim()} icon={icon} /> : <span className="muted small">no badge</span>}
        </div>
      </div>

      <label className="field">
        <span>Nickname</span>
        <input
          className="input"
          autoFocus
          maxLength={NICK_MAX}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Bug Hunter"
        />
        <small className={tooShort ? "text-warn" : "muted"}>
          {len}/{NICK_MAX} · visible to everyone at 42 Amman · staff can remove badges that aren't appropriate
        </small>
      </label>

      <div className="field">
        <span>Icon</span>
        <div className="icon-picker" role="radiogroup" aria-label="Badge icon">
          {BADGE_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={icon === name}
              aria-label={name.replace(/-/g, " ")}
              title={name.replace(/-/g, " ")}
              className={`icon-pick ${icon === name ? "is-on" : ""}`}
              onClick={() => setIcon(name)}
            >
              <PixelIcon name={name} size={22} />
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
    </Modal>
  );
}
