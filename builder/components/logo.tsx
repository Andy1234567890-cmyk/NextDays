// Plattform-Logo als Vektor-Lockup aus Figma (freigegeben 21.08.2026).
// Vorher lag hier ein 1600x1600-PNG mit breitem transparenten Rand, das per
// gemessener BBox und CSS-Transform zurechtgeschoben wurde. Das Figma-Asset
// ist exakt beschnitten (245x44), deshalb entfaellt der Crop-Mechanismus.
//
// Nur die helle Variante (Markenrot #B82028): der Baukasten zeigt das
// myNextDays-Lockup ausschliesslich in der Kopfzeile auf `bg-background`.
// Fuer dunkle Flaechen liegt `mnd_lockup_negativ.svg` (#E24B4A, Schrift weiss)
// daneben bereit.
const ASPECT = 245 / 44;

export function Logo({
  heightRem = 2.25,
  src,
  alt,
}: {
  heightRem?: number;
  // White-Label: Agentur-Logo aus dem Branding. Gesetzt → schlichte Darstellung
  // (freies Seitenverhältnis), sonst der myNextDays-Standard.
  src?: string | null;
  alt?: string | null;
}) {
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/marketing/brand/mnd_lockup.svg"
      alt="myNextDays"
      width={heightRem * ASPECT * 16}
      height={heightRem * 16}
      style={{
        height: `${heightRem}rem`,
        width: `${heightRem * ASPECT}rem`,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
