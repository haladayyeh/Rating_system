// Ratings are 1–3 stars.
const MAX = 3;

function StarIcon({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
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

// Big interactive picker for the rating modal
export function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="Stars">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`star-option ${value === n ? "is-active" : ""} star-option-${n}`}
          onClick={() => onChange(n)}
        >
          <Stars value={n} size={22} />
          <strong>{STAR_MEANING[n].title}</strong>
          <small>{STAR_MEANING[n].hint}</small>
        </button>
      ))}
    </div>
  );
}
