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

export function Logo({ heightRem = 1.75 }: { heightRem?: number }) {
  const widthRem = heightRem * ASPECT;

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
        alt="NextDays — powered by AirSmil"
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
