import PixelIcon from "./PixelIcon";

// Pixel icon for each rating label (matched by name, case-insensitive).
// Labels staff create later fall back to an icon based on their severity.
const BY_NAME = {
  // POSITIVE
  "helpful": "potion-red",              // a healing potion
  "good teammate": "heart",
  "community contributor": "house",
  "respectful": "medal",
  "fair": "check",
  "thorough": "key-gold",               // unlocks every detail
  "clear explainer": "speech",
  "helpful feedback": "envelope",
  "well prepared": "helmet",            // armored up
  "knows their code": "crystal",
  "open to feedback": "gift",
  // MINOR
  "unreliable teammate": "heart-half",
  "disruptive": "flame",
  "rushed": "clock",
  "late": "snail",
  "defensive": "shield",
  // SERIOUS
  "aggressive behavior": "sword",
  "disrespectful": "cross",
  "bad evaluator": "arrow-down",
  "unprepared": "drop",                 // a nervous sweat drop
};

const BY_SEVERITY = { POSITIVE: "star-gold", MINOR: "exclamation", SERIOUS: "skull" };

export function labelIcon(name, severity) {
  return BY_NAME[String(name || "").trim().toLowerCase()] || BY_SEVERITY[severity] || "pin";
}

export default function LabelIcon({ name, severity, size = 16 }) {
  return <PixelIcon name={labelIcon(name, severity)} size={size} className="label-icon" />;
}
