// Pixel-art icons from public/pixel/*.svg
//
// Loaded as <img> on purpose: every SVG defines the same class names (.cls-1, .cls-2…)
// with different colors, so inlining them would make their colors clash.
//
// Available names:
//   keys      key-silver key-gold
//   gems      pin crystal ruby
//   marks     plus check cross question exclamation
//   danger    skull bomb flame fire
//   rewards   medal trophy gift crown coin
//   gear      clock shield helmet sword magic-sword arrow
//   arrows    arrow-up arrow-down
//   potions   potion-red potion-yellow potion-blue potion-teal
//   misc      house envelope speech drop snail
//   stars     star-gold star-blue star-red star-teal
//   hearts    heart heart-empty heart-half

export default function PixelIcon({ name, size = 20, label, className = "", style }) {
  return (
    <img
      src={`/pixel/${name}.svg`}
      alt={label || ""}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      draggable="false"
      className={`px-icon ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}
