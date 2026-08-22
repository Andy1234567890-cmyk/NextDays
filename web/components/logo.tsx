// myNextDays-Logo als Vektor-Lockup aus Figma (freigegeben 21.08.2026).
// Vorher lag hier ein 1600x1600-PNG mit breitem transparenten Rand, das per
// gemessener BBox und CSS-Transform zurechtgeschoben wurde. Die Figma-Assets
// sind exakt beschnitten (245x44), deshalb entfaellt der Crop-Mechanismus und
// wir rendern das SVG direkt.
//
// Zwei Dateien statt eines CSS-Filters, weil das Markenrot je Untergrund ein
// anderes ist: #B82028 auf hellen Flaechen (mnd_lockup.svg), #E24B4A auf
// dunklen (mnd_lockup_negativ.svg, Schrift dort weiss). Ein invert()-Filter
// wuerde diesen Rotton kippen.
const ASPECT = 245 / 44;

// `dark`: helle Logo-Variante für dunkle Hintergründe (z. B. schwarzer Footer).
export function Logo({
  heightRem = 1.75,
  dark = false,
}: {
  heightRem?: number;
  dark?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        dark
          ? "/marketing/brand/mnd_lockup_negativ.svg"
          : "/marketing/brand/mnd_lockup.svg"
      }
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
