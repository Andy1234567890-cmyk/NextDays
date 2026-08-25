// Länderflaggen für den Sprachwähler — als Inline-SVG, ein Pfadsatz je Land.
//
// WARUM NICHT EMOJI: `🇩🇪` ist die naheliegende Abkürzung und auf dieser Seite
// die falsche. Regional-Indicator-Paare haben unter Windows KEINE Glyphe
// (Segoe UI Emoji trägt sie bis heute nicht) — Chrome und Edge zeigen dort
// stattdessen die zwei Buchstaben „DE" in einem Kasten. Der Sprachwähler wäre
// damit auf dem größten Desktop-Marktanteil eine Buchstabensuppe, und genau
// dort ist die Flagge das Erkennungsmerkmal, das den Endonym-Namen ergänzt.
//
// WARUM NICHT flagcdn/flag-icons: ein Drittanbieter-Request pro Flagge (24 auf
// einer offenen Liste) auf einer Seite, die ihre Schriften und Icons BEWUSST
// lokal ausliefert (siehe components/ui/icon.tsx).
//
// GENAUIGKEIT — was hier bewusst NICHT gezeichnet ist: Wappen und Siegel
// (Malta, Slowakei, Slowenien, Kroatien, Spanien, Portugal). Ein nachgemaltes
// Staatswappen wäre bei 1,25 rem Höhe ein unlesbarer Fleck und in der Sache
// eine Erfindung. Gezeichnet sind deshalb die Grundfelder — die Farbfolge, an
// der man die Flagge auf dieser Größe ohnehin erkennt. Die Farben stammen aus
// den amtlichen Vorgaben (Konstruktionsblätter der jeweiligen Länder).
//
// Alle Flaggen im Verhältnis 4:3 auf `viewBox="0 0 4 3"`, damit sie in einer
// Reihe gleich hoch stehen; Ausnahmen im echten Seitenverhältnis (Dänemark
// 28:37, Schweden 5:8) sind auf 4:3 beschnitten wie in jedem Flaggensatz üblich.
import type { Locale } from "@/i18n/locales";

/**
 * Land je Sprache — NICHT aus dem Sprachcode geraten.
 *
 * Für die meisten stimmt Sprachcode == Ländercode (de→DE, fr→FR), für vier
 * nicht: Englisch ist nach dem Brexit über IRLAND EU-Amtssprache (en→IE),
 * Griechisch schreibt sich el aber das Land ist GR, Tschechisch cs → CZ,
 * Dänisch da → DK. Ein `code.toUpperCase()` hätte hier vier falsche Flaggen
 * gezeigt, ohne dass es auffällt.
 */
const LAND: Record<Locale, string> = {
  bg: "BG",
  cs: "CZ",
  da: "DK",
  de: "DE",
  el: "GR",
  en: "IE",
  es: "ES",
  et: "EE",
  fi: "FI",
  fr: "FR",
  ga: "IE",
  hr: "HR",
  hu: "HU",
  it: "IT",
  lt: "LT",
  lv: "LV",
  mt: "MT",
  nl: "NL",
  pl: "PL",
  pt: "PT",
  ro: "RO",
  sk: "SK",
  sl: "SI",
  sv: "SE",
};

/** Drei waagerechte Streifen gleicher Höhe. */
function quer(a: string, b: string, c: string) {
  return (
    <>
      <rect width="4" height="1" fill={a} />
      <rect y="1" width="4" height="1" fill={b} />
      <rect y="2" width="4" height="1" fill={c} />
    </>
  );
}

/** Drei senkrechte Streifen gleicher Breite. */
function laengs(a: string, b: string, c: string) {
  return (
    <>
      <rect width="1.3333" height="3" fill={a} />
      <rect x="1.3333" width="1.3334" height="3" fill={b} />
      <rect x="2.6667" width="1.3333" height="3" fill={c} />
    </>
  );
}

/** Skandinavisches Kreuz: Grundfarbe + Kreuz, Achse links der Mitte. */
function kreuz(grund: string, balken: string, innen?: string) {
  const dicke = innen ? 1 : 0.75;
  return (
    <>
      <rect width="4" height="3" fill={grund} />
      <rect y={(3 - dicke) / 2} width="4" height={dicke} fill={balken} />
      <rect x={1.5 - dicke / 2} width={dicke} height="3" fill={balken} />
      {innen ? (
        <>
          <rect y="1.375" width="4" height="0.25" fill={innen} />
          <rect x="1.375" width="0.25" height="3" fill={innen} />
        </>
      ) : null}
    </>
  );
}

const FLAGGEN: Record<string, () => React.ReactNode> = {
  // Weiß–Grün–Rot, Streifen gleich hoch.
  BG: () => quer("#fff", "#00966e", "#d62612"),
  // Weiß über Rot mit blauem Keil von der Stange.
  CZ: () => (
    <>
      <rect width="4" height="1.5" fill="#fff" />
      <rect y="1.5" width="4" height="1.5" fill="#d7141a" />
      <path d="M0 0l2 1.5L0 3z" fill="#11457e" />
    </>
  ),
  DK: () => kreuz("#c8102e", "#fff"),
  DE: () => quer("#000", "#dd0000", "#ffce00"),
  // Neun Streifen Blau/Weiß plus Kreuz-Kanton — der Kanton ist fünf Streifen
  // hoch und fünf breit, deshalb hier maßstäblich statt frei geschätzt.
  GR: () => (
    <>
      <rect width="4" height="3" fill="#0d5eaf" />
      {[1, 3, 5, 7].map((i) => (
        <rect key={i} y={(i * 3) / 9} width="4" height={3 / 9} fill="#fff" />
      ))}
      <rect width={(5 * 3) / 9} height={(5 * 3) / 9} fill="#0d5eaf" />
      <rect y={(2 * 3) / 9} width={(5 * 3) / 9} height={3 / 9} fill="#fff" />
      <rect x={(2 * 3) / 9} width={3 / 9} height={(5 * 3) / 9} fill="#fff" />
    </>
  ),
  IE: () => laengs("#169b62", "#fff", "#ff883e"),
  // Rot–Gelb–Rot, der gelbe Streifen doppelt so hoch wie ein roter.
  ES: () => (
    <>
      <rect width="4" height="3" fill="#aa151b" />
      <rect y="0.75" width="4" height="1.5" fill="#f1bf00" />
    </>
  ),
  EE: () => quer("#4891d9", "#000", "#fff"),
  FI: () => kreuz("#fff", "#003580"),
  FR: () => laengs("#002395", "#fff", "#ed2939"),
  // Rot–Weiß–Blau; das Wappen in der Mitte ist bewusst weggelassen.
  HR: () => quer("#ff0000", "#fff", "#171796"),
  // Rot–Weiß–Grün.
  HU: () => quer("#ce2939", "#fff", "#477050"),
  IT: () => laengs("#008c45", "#f4f5f0", "#cd212a"),
  LT: () => quer("#fdb913", "#006a44", "#c1272d"),
  // Karminrot–Weiß–Karminrot, der weiße Streifen ist nur ein Fünftel hoch.
  LV: () => (
    <>
      <rect width="4" height="3" fill="#9e3039" />
      <rect y="1.2" width="4" height="0.6" fill="#fff" />
    </>
  ),
  // Weiß an der Stange, Rot außen; das George-Kreuz oben links fehlt (s. o.).
  MT: () => (
    <>
      <rect width="2" height="3" fill="#fff" />
      <rect x="2" width="2" height="3" fill="#cf142b" />
    </>
  ),
  NL: () => quer("#ae1c28", "#fff", "#21468b"),
  // Weiß über Rot.
  PL: () => (
    <>
      <rect width="4" height="1.5" fill="#fff" />
      <rect y="1.5" width="4" height="1.5" fill="#dc143c" />
    </>
  ),
  // Grün (zwei Fünftel) und Rot; das Wappen auf der Naht fehlt (s. o.).
  PT: () => (
    <>
      <rect width="4" height="3" fill="#da291c" />
      <rect width="1.6" height="3" fill="#046a38" />
    </>
  ),
  RO: () => laengs("#002b7f", "#fcd116", "#ce1126"),
  // Weiß–Blau–Rot; das Wappen links der Mitte fehlt (s. o.).
  SK: () => quer("#fff", "#0b4ea2", "#ee1c25"),
  SI: () => quer("#fff", "#005ce6", "#d50000"),
  SE: () => kreuz("#005293", "#fecb00"),
};

/**
 * Eine Länderflagge zur Sprache.
 *
 * Rein dekorativ (`aria-hidden`): der Sprachname steht als Text daneben, und
 * eine Flagge ist ohnehin kein Name für eine Sprache — Vorlesesoftware soll
 * „Deutsch" sagen, nicht „Flagge Deutschlands, Deutsch".
 */
export function Flagge({
  locale,
  className,
  /** Auf dunklem Grund (Footer) muss die Kante hell sein, nicht schwarz. */
  dark = false,
}: {
  locale: Locale;
  className?: string;
  dark?: boolean;
}) {
  const Zeichnung = FLAGGEN[LAND[locale]];
  // Fehlt ein Land, wird NICHT ersatzweise irgendeine Flagge gezeigt (Wurzel 4)
  // — die Zeile trägt dann nur ihren Sprachnamen.
  if (!Zeichnung) return null;
  return (
    <svg
      aria-hidden
      viewBox="0 0 4 3"
      // Feine Kante, damit die weißen Felder (Polen, Malta, Finnland) nicht
      // mit dem Untergrund verschmelzen — das Rechteck wäre dort sonst zur
      // Hälfte unsichtbar und die Flagge nicht wiedererkennbar.
      className={`shrink-0 rounded-[0.1875rem] ring-1 ring-inset ${dark ? "ring-white/25" : "ring-black/20"} ${className ?? ""}`}
    >
      <Zeichnung />
    </svg>
  );
}
