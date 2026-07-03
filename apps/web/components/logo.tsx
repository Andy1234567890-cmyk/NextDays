// NextDays-Logo aus der transparenten Originaldatei.
// Die Datei hat viel transparente Flaeche; wir zeigen deshalb nur den sichtbaren
// Bereich (bbox), damit das Logo nicht winzig/verzerrt wirkt.

// Gemessen aus Logo_transparent.png via trim: 1446x375 @ offset x=87, y=420
const SOURCE_SIZE = 1600;
const VISIBLE = { x: 87, y: 420, w: 1446, h: 375 };
const ASPECT = VISIBLE.w / VISIBLE.h;

const SCALE = SOURCE_SIZE / VISIBLE.w;
const SHIFT_X = (VISIBLE.x / SOURCE_SIZE) * 100;
const SHIFT_Y = (VISIBLE.y / SOURCE_SIZE) * 100;

// `dark`: helle Logo-Variante für dunkle Hintergründe (z. B. schwarzer Footer).
// Echtes Asset statt CSS-Filter, damit das Logo-Rot (AirSmil) nicht kippt; die
// Datei ist bereits zugeschnitten, daher kein Crop-Transform.
export function Logo({
  heightRem = 1.75,
  dark = false,
}: {
  heightRem?: number;
  dark?: boolean;
}) {
  const widthRem = heightRem * ASPECT;

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
          maxWidth: "none", // verhindert responsive Verkleinerung des Crops
          transform: `translate(-${SHIFT_X}%, -${SHIFT_Y}%)`,
        }}
      />
    </span>
  );
}
