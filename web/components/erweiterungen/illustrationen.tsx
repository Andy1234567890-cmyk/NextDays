// Illustrationen der Erweiterungs-Verkaufsseiten.
//
// EIGENE Zeichnungen als Inline-SVG — Lodgify nutzt an dieser Stelle gezeichnete
// Line-Art-Bilder (`colored-check`, `colored-calendar`, `colored-booking-house`)
// plus einen Produkt-Screenshot im Hero. Deren Dateien sind fremdes Material und
// werden NICHT kopiert; hier stehen gleichwertige eigene Motive, die zusätzlich
// zeigen, was das Modul bei UNS wirklich tut (Preiskurve mit Min/Max-Grenzen,
// Kalender mit Tagespreisen, Regler für die Grenzen).
//
// Warum Inline-SVG und keine PNG-Assets: skaliert scharf, trägt keine feste
// Farbe (Striche über `currentColor`, Akzente über `text-primary`) und läuft
// damit in hell UND dunkel — ein exportiertes Bild müsste je Theme doppelt
// vorliegen. Kein Hex-Wert (Tailwind-Regel), Maße in rem über die Klassen.
import type { ReactNode } from "react";

const STRICH = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Rahmen mit einheitlichem Strich-Stil; Kinder erben `currentColor`. */
function Zeichnung({
  viewBox,
  className,
  children,
  label,
}: {
  viewBox: string;
  className?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label={label}
      strokeWidth={1.5}
      {...STRICH}
    >
      {children}
    </svg>
  );
}

/**
 * Hero-Motiv: 30-Tage-Preisverlauf mit Mindest- und Höchstpreis.
 *
 * Zeigt die Kernaussage des Moduls in einem Bild: der Preis schwingt mit der
 * Nachfrage, bleibt aber zwischen den beiden Grenzen, die der Betrieb setzt.
 * Bewusst ohne Beträge — echte Zahlen kämen aus den Daten, erfundene wären eine
 * Preisaussage (Wurzel 4).
 */
export function PreisverlaufIllustration({ className }: { className?: string }) {
  // Eine Kurve, zwei Ableitungen: der Strich zeichnet den Preisverlauf, dieselbe
  // Form zurück zur Grundlinie geschlossen ergibt die getönte Fläche darunter.
  const kurve =
    "M48 150c18-4 26-30 44-30s24 22 42 22 26-38 44-38 26 34 44 34 " +
    "24-30 42-30 28 26 46 26 26-34 42-34 24 20 40 20";
  return (
    <Zeichnung
      viewBox="0 0 440 210"
      className={className}
      label="Preisverlauf zwischen Mindest- und Höchstpreis"
    >
      {/* Hilfslinien */}
      <g className="text-muted-foreground/25" stroke="currentColor">
        <path d="M48 40h360M48 78h360M48 116h360M48 154h360" />
        <path d="M48 28v148" />
      </g>
      {/* Fläche unter der Kurve */}
      <path
        d={`${kurve}V176H48Z`}
        className="text-primary"
        fill="currentColor"
        stroke="none"
        opacity={0.1}
      />
      {/* Preiskurve: Wochenenden hoch, übrige Lücken runter, immer im Rahmen */}
      <path d={kurve} className="text-primary" stroke="currentColor" strokeWidth={2.5} />
      {/* Die beiden Grenzen, die der Betrieb setzt */}
      <g className="text-muted-foreground" stroke="currentColor">
        <path d="M48 58h360" strokeDasharray="6 6" />
        <path d="M48 168h360" strokeDasharray="6 6" />
      </g>
      <g className="fill-current text-muted-foreground" stroke="none" fontSize="11">
        <text x="48" y="50">
          Höchstpreis
        </text>
        <text x="48" y="184">
          Mindestpreis
        </text>
      </g>
      {/* Ein herausgegriffener Tag mit seinem Preis-Punkt */}
      <g className="text-primary" stroke="currentColor">
        <circle cx="264" cy="114" r="5" fill="currentColor" />
        <path d="M264 119v49" strokeDasharray="4 5" />
      </g>
    </Zeichnung>
  );
}

/** Schritt 1: Modul einschalten (Schalter + Häkchen). */
export function AktivierenIllustration({ className }: { className?: string }) {
  return (
    <Zeichnung viewBox="0 0 120 120" className={className} label="Modul aktivieren">
      <g className="text-muted-foreground" stroke="currentColor">
        <rect x="16" y="46" width="88" height="36" rx="18" />
      </g>
      <circle cx="82" cy="64" r="12" className="text-primary" fill="currentColor" />
      <path
        d="M28 64l10 10 18-22"
        className="text-primary"
        stroke="currentColor"
        strokeWidth={2.5}
      />
      <g className="text-muted-foreground/40" stroke="currentColor">
        <path d="M60 24v-8M84 34l6-6M36 34l-6-6M60 96v8" />
      </g>
    </Zeichnung>
  );
}

/** Schritt 2: Tagespreise im Kalender prüfen. */
export function KalenderPreiseIllustration({ className }: { className?: string }) {
  return (
    <Zeichnung
      viewBox="0 0 120 120"
      className={className}
      label="Tagespreise im Kalender"
    >
      <g className="text-muted-foreground" stroke="currentColor">
        <rect x="14" y="22" width="92" height="80" rx="10" />
        <path d="M14 42h92M38 22v-8M82 22v-8" />
        <path d="M38 42v60M62 42v60M86 42v60M14 62h92M14 82h92" />
      </g>
      <g className="text-primary" stroke="currentColor">
        <rect x="38" y="62" width="24" height="20" fill="currentColor" opacity={0.12} />
        <path d="M44 72h12" strokeWidth={2.5} />
        <path d="M68 52h12M92 92h8" strokeWidth={2.5} />
      </g>
    </Zeichnung>
  );
}

/** Schritt 3: Mindest- und Höchstpreis festlegen. */
export function GrenzenIllustration({ className }: { className?: string }) {
  return (
    <Zeichnung
      viewBox="0 0 120 120"
      className={className}
      label="Mindest- und Höchstpreis festlegen"
    >
      <g className="text-muted-foreground" stroke="currentColor">
        <path d="M20 44h80M20 76h80" />
        <circle cx="44" cy="44" r="9" />
        <circle cx="76" cy="76" r="9" />
      </g>
      <g className="text-primary" stroke="currentColor" strokeWidth={2.5}>
        <path d="M44 44h56M20 76h56" />
      </g>
      <g className="text-muted-foreground/40" stroke="currentColor">
        <path d="M20 100h80" />
      </g>
    </Zeichnung>
  );
}

/** Illustrationen der drei Einrichtungsschritte — Reihenfolge wie im Katalog
 *  (aktivieren → Objekte/Grenzen einstellen → Preise in der Vorschau prüfen). */
export const SCHRITT_ILLUSTRATIONEN = [
  AktivierenIllustration,
  GrenzenIllustration,
  KalenderPreiseIllustration,
] as const;

/**
 * Hero-Motiv der Schloss-Module: Buchung → Türcode → Tür.
 *
 * WARUM EIN EIGENES MOTIV: die Schloss-Seiten zeigten bis 06.09.2026 die
 * `PreisverlaufIllustration` — die Grafik des Dynamic-Pricing-Moduls, weil sie
 * in der Detailseite fest verdrahtet war. Auf der igloohome-Seite stand damit
 * eine Preiskurve mit „Mindestpreis/Höchstpreis": ein Bild, das über das Modul
 * eine falsche Aussage macht.
 *
 * Bewusst KEIN Marken-Motiv und keine Geräteform eines Herstellers: dieselbe
 * Zeichnung gilt für alle 32 Anbieter. Die Marke steht als echtes Logo in der
 * Kopfzeile, nicht in einer nachgebauten Produktzeichnung.
 *
 * Der Code im Bild ist bewusst maskiert (Punkte statt Ziffern) — ein
 * ausgeschriebener Beispielcode wäre eine erfundene Angabe (Wurzel 4) und
 * würde in Screenshots wie ein echter Code aussehen.
 */
export function TuercodeIllustration({ className }: { className?: string }) {
  return (
    <Zeichnung viewBox="0 0 520 220" className={className} label="">
      {/* Links: die Buchung als Karte mit Zeitraum. */}
      <rect x="24" y="52" width="118" height="116" rx="10" />
      <path d="M24 84h118" />
      <path d="M52 52V40M114 52V40" />
      <path d="M46 108h74M46 128h48" opacity={0.55} />

      {/* Pfeil Buchung → Code. */}
      <path d="M158 110h44" className="text-primary" opacity={0.9} />
      <path d="m194 102 8 8-8 8" className="text-primary" opacity={0.9} />

      {/* Mitte: der Code als Tastenfeld, Ziffern maskiert. */}
      <rect x="216" y="60" width="96" height="100" rx="12" className="text-primary" />
      <circle cx="240" cy="88" r="4" className="text-primary" />
      <circle cx="264" cy="88" r="4" className="text-primary" />
      <circle cx="288" cy="88" r="4" className="text-primary" />
      <circle cx="240" cy="112" r="4" className="text-primary" opacity={0.5} />
      <circle cx="264" cy="112" r="4" className="text-primary" opacity={0.5} />
      <circle cx="288" cy="112" r="4" className="text-primary" opacity={0.5} />
      <path d="M240 136h48" className="text-primary" opacity={0.5} />

      {/* Pfeil Code → Tür. */}
      <path d="M328 110h44" className="text-primary" opacity={0.9} />
      <path d="m364 102 8 8-8 8" className="text-primary" opacity={0.9} />

      {/* Rechts: die Tür mit Schloss und Griff. */}
      <path d="M388 176V56a8 8 0 0 1 8-8h84a8 8 0 0 1 8 8v120" />
      <path d="M376 176h124" />
      <circle cx="464" cy="116" r="5" />
      <rect x="410" y="98" width="30" height="26" rx="5" className="text-primary" />
      <path d="M416 98v-7a9 9 0 0 1 18 0v7" className="text-primary" />
    </Zeichnung>
  );
}
