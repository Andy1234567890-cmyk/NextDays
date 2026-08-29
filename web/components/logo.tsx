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

// STANDARD ist „folgt dem Theme": beide Bilder werden gerendert, `.dark` auf
// <html> (next-themes, attribute="class") blendet das passende ein. Bewusst
// NICHT ueber `useTheme()` — dessen Wert steht beim ersten Rendern serverseitig
// nicht fest, was einen Hydration-Mismatch und ein sichtbares Aufblitzen des
// falschen Logos ergaebe.
//
// Warum Standard und nicht Opt-in: geprueft am 29.08.2026 trugen ALLE ELF
// Aufrufstellen im Dashboard eine Flaeche, die mit dem Theme mitwechselt
// (`bg-background`/`bg-card`/`bg-sidebar`) — und keine einzige uebergab eine
// Variante. Im Dunkelmodus stand damit ueberall dunkle Schrift auf dunklem
// Grund: sichtbar blieb nur das rote „Next", „my" und „Days" verschwanden.
// Gemeldet an der Sidebar, lag es real an der Voreinstellung. Ein Opt-in, das
// elf von zwoelf Stellen brauchen, ist die falsche Voreinstellung.
//
// `dark`: helle Variante ERZWINGEN — nur fuer Flaechen, die unabhaengig vom
//   Theme dunkel sind (der schwarze Marketing-Footer, auch im Hellmodus).
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
  const hell = nurZeichen
    ? "/marketing/brand/mnd_zeichen.svg"
    : "/marketing/brand/mnd_lockup.svg";
  const dunkel = nurZeichen
    ? "/marketing/brand/mnd_zeichen_negativ.svg"
    : "/marketing/brand/mnd_lockup_negativ.svg";

  const masse = {
    height: `${heightRem}rem`,
    width: `${heightRem * seitenverhaeltnis}rem`,
    flexShrink: 0,
  } as const;
  const breite = heightRem * seitenverhaeltnis * 16;
  const hoehe = heightRem * 16;

  // `dark` erzwingt die helle Variante; ohne das Flag folgt das Logo dem Theme.
  if (!dark) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hell}
          alt="myNextDays"
          width={breite}
          height={hoehe}
          style={masse}
          className="inline-block dark:hidden"
        />
        {/* Zweites Bild leer bemasst (alt=""), damit Screenreader die Marke
            nicht doppelt vorlesen — sichtbar ist immer genau eines.
            `display` steht hier bewusst NICHT im style-Attribut: ein
            Inline-Style schlaegt jede Klasse, das Umschalten braeuchte dann ein
            `!important` gegen die eigene Komponente. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dunkel}
          alt=""
          width={breite}
          height={hoehe}
          style={masse}
          className="hidden dark:inline-block"
        />
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dunkel}
      alt="myNextDays"
      width={breite}
      height={hoehe}
      style={{ ...masse, display: "inline-block" }}
    />
  );
}
