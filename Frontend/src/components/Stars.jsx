import { useState } from "react";
import PixelIcon from "./PixelIcon";

// Ratings are 1–3 stars.
const MAX = 3;

// Pixel star sprite per rating level: 1 red, 2 gold, 3 teal
export const LEVEL_STAR = { 1: "star-red", 2: "star-gold", 3: "star-teal" };

// Read-only display (averages, rating lists); gold pixel stars.
// Supports fractional values (e.g. 2.4): the gold layer is clipped over a grey one.
export function Stars({ value, size = 18 }) {
  const v = value ?? 0;
  return (
    <span className="stars" aria-label={`${value ?? "no"} out of ${MAX} stars`}>
      {Array.from({ length: MAX }, (_, i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        return (
          <span key={i} className="star" style={{ width: size, height: size }}>
            <span className="star-empty"><PixelIcon name="star-gold" size={size} /></span>
            <span className="star-full" style={{ width: `${fill * 100}%` }}>
              <PixelIcon name="star-gold" size={size} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export const STAR_MEANING = {
  1: { title: "Needs work", hint: "Something went wrong in the collaboration" },
  2: { title: "Good", hint: "Solid, with some room to grow" },
  3: { title: "Excellent", hint: "Went above and beyond" },
};

// Big interactive picker for the rating modal:
// 3 big stars, hover to preview, click to choose. The chosen stars fill one after another.
export function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(null);
  const [pulse, setPulse] = useState(0); // changes on every pick, so the fill animation replays
  const shown = hover ?? value ?? 0;
  const meaning = STAR_MEANING[hover ?? value];

  function pick(n) {
    onChange(n);
    setPulse((p) => p + 1);
  }

  // Keyboard: arrows move between 1–3 stars
  function onKeyDown(e) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      pick(Math.min(MAX, (value ?? 0) + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      pick(Math.max(1, (value ?? 2) - 1));
    }
  }

  return (
    <div className={`star-picker ${value ? "has-value" : ""}`} data-level={shown || undefined}>
      <div
        className="big-stars"
        role="radiogroup"
        aria-label="How many stars"
        onMouseLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}: ${STAR_MEANING[n].title}`}
            tabIndex={(value ?? 1) === n ? 0 : -1}
            className={`big-star ${n <= shown ? "is-on" : ""} ${hover && n <= hover ? "is-preview" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => pick(n)}
          >
            <span
              key={n <= (value ?? 0) ? `${pulse}-on` : "off"}
              className={`big-star-icon ${n <= (value ?? 0) ? "is-picked" : ""}`}
              style={{ animationDelay: `${(n - 1) * 90}ms` }}
            >
              {/* lit stars all take the color of the current level; the rest are grey */}
              <PixelIcon name={n <= shown ? LEVEL_STAR[shown] : "star-gold"} size={44} />
            </span>
          </button>
        ))}
      </div>
      <div className="star-meaning" aria-live="polite">
        {meaning ? (
          <>
            <strong>{meaning.title}</strong>
            <small>{meaning.hint}</small>
          </>
        ) : (
          <small>Tap a star to rate</small>
        )}
      </div>
    </div>
  );
}
