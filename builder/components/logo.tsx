// Plattform-Logo aus der transparenten Originaldatei.
// Die Datei enthaelt viel transparente Flaeche; wir croppen die sichtbare
// BBox im Rendering, damit das Logo nicht winzig wirkt.
const SOURCE_SIZE = 1600;
const VISIBLE = { x: 87, y: 420, w: 1446, h: 375 };
const ASPECT = VISIBLE.w / VISIBLE.h;

const SCALE = SOURCE_SIZE / VISIBLE.w;
const SHIFT_X = (VISIBLE.x / SOURCE_SIZE) * 100;
const SHIFT_Y = (VISIBLE.y / SOURCE_SIZE) * 100;

export function Logo({
  heightRem = 2.25,
  src,
  alt,
}: {
  heightRem?: number;
  // White-Label: Agentur-Logo aus dem Branding. Gesetzt → schlichte Darstellung
  // (freies Seitenverhältnis), sonst der myNextDays-Standard mit BBox-Crop.
  src?: string | null;
  alt?: string | null;
}) {
  const widthRem = heightRem * ASPECT;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? "Logo"}
        style={{ height: `${heightRem}rem`, width: "auto", flexShrink: 0 }}
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
        alt="myNextDays"
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
