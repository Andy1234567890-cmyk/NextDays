// Marketing-Logo. Zwei echte Assets statt CSS-Filter, damit die Markenfarben
// (Logo-Rot #b82028 im „AirSmil") stimmen:
//  - hell/Standard: die transparente Originaldatei mit viel Rand → wir croppen
//    die sichtbare BBox im Rendering, damit das Logo nicht winzig wirkt.
//  - `dark`: die bereits zugeschnittene helle Variante für dunkle Hintergründe
//    (z. B. den schwarzen Footer) — kein Crop-Transform nötig.
const SOURCE_SIZE = 1600;
const VISIBLE = { x: 87, y: 420, w: 1446, h: 375 };
const ASPECT = VISIBLE.w / VISIBLE.h;

const SCALE = SOURCE_SIZE / VISIBLE.w;
const SHIFT_X = (VISIBLE.x / SOURCE_SIZE) * 100;
const SHIFT_Y = (VISIBLE.y / SOURCE_SIZE) * 100;

export function Logo({
  heightRem = 2.25,
  dark = false,
}: {
  heightRem?: number;
  dark?: boolean;
}) {
  const widthRem = heightRem * ASPECT;

  // Helle Variante: bereits zugeschnitten (1470×399), einfach skaliert füllen.
  if (dark) {
    return (
      <img
        src="/marketing/brand/mynextdays-logo-light.png"
        alt="myNextDays — powered by AirSmil"
        style={{
          height: `${heightRem}rem`,
          width: "auto",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      style={{
        width: `${widthRem}rem`,
        height: `${heightRem}rem`,
        display: "inline-block",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src="/Logo_transparent.png"
        alt="myNextDays — powered by AirSmil"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: `${SCALE * 100}%`,
          height: "auto",
          maxWidth: "none",
          transform: `translate(-${SHIFT_X}%, -${SHIFT_Y}%)`,
        }}
      />
    </span>
  );
}
