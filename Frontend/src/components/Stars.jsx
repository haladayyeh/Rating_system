import { useState } from "react";

// Ratings are 1–3 stars.
const MAX = 3;

function StarIcon({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
    </svg>
  );
}

// Big picker star: longer points, rounded tips (rounded by the stroke in CSS)
const BIG_STAR = "M12 2.7L14.41 9.58L21.7 9.75L15.9 14.17L18 21.15L12 17L6 21.15L8.1 14.17L2.3 9.75L9.59 9.58Z";
function BigStarIcon({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={BIG_STAR} />
    </svg>
  );
}

// Read-only display; supports fractional values (e.g. 2.4)
export function Stars({ value, size = 18 }) {
  const v = value ?? 0;
  return (
    <span className="stars" aria-label={`${value ?? "no"} out of ${MAX} stars`}>
      {Array.from({ length: MAX }, (_, i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        return (
          <span key={i} className="star" style={{ width: size, height: size }}>
            <span className="star-empty"><StarIcon size={size} /></span>
            <span className="star-full" style={{ width: `${fill * 100}%` }}>
              <StarIcon size={size} />
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
// 3 big stars — hover to preview, click to choose. The chosen stars fill one after another.
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
              <BigStarIcon size={44} />
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
