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
// `nurZeichen`: nur das Doppel-Chevron ohne Schriftzug, quadratisch (36x36).
//   Gebraucht fuer die EINGEKLAPPTE Sidebar: dort ist die Leiste rund 3 rem
//   breit, das Lockup ist mit 245x44 aber 5,6:1 — es passte nicht hinein und
//   war deshalb schlicht versteckt, was eine leere Kopfzeile ergab. Die Pfade
//   sind dieselben wie im Lockup (Figma-Gruppe „chevron-icon"), kein zweites
//   Gestaltungsmittel.
export function Logo({
  heightRem = 1.75,
  dark = false,
  nurZeichen = false,
}: {
  heightRem?: number;
  dark?: boolean;
  nurZeichen?: boolean;
}) {
  const seitenverhaeltnis = nurZeichen ? 1 : ASPECT;
  const quelle = nurZeichen
    ? dark
      ? "/marketing/brand/mnd_zeichen_negativ.svg"
      : "/marketing/brand/mnd_zeichen.svg"
    : dark
      ? "/marketing/brand/mnd_lockup_negativ.svg"
      : "/marketing/brand/mnd_lockup.svg";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={quelle}
      alt="myNextDays"
      width={heightRem * seitenverhaeltnis * 16}
      height={heightRem * 16}
      style={{
        height: `${heightRem}rem`,
        width: `${heightRem * seitenverhaeltnis}rem`,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
