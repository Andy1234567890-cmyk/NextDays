// Illustrationen für die drei Kernnutzen.
//
// Referenz-UX (hostaway.com): in den Nutzen-Spalten steckt keine Icon-Glyphe,
// sondern eine gezeichnete Line-Illustration in einem hell getönten Kreis —
// deutlich mehr Blickfang und erzählt die Aussage mit.
//
// Eigene Zeichnungen (keine Stock-Assets), Linien in `currentColor`, damit sie
// die Akzentfarbe des Kreises erben. Deckkraft als SVG-Attribut, weil
// Tailwinds Arbitrary-Opacity in v4 unzuverlässig kompiliert.
type Props = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Mehr Buchungen: Objekt + steigende Buchungskurve über mehrere Kanäle. */
export function IllustrationBookings({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      {/* Boden */}
      <path d="M10 82h76" {...STROKE} opacity="0.3" />
      {/* Objekt */}
      <path d="M16 48 34 32l18 16" {...STROKE} />
      <path d="M20 48v34h28V48" {...STROKE} />
      <path d="M29 82V66h10v16" {...STROKE} opacity="0.55" />
      {/* Buchungskurve */}
      <path d="M56 68l10-12 8 6 12-22" {...STROKE} />
      <path d="M78 40h8v8" {...STROKE} />
      <circle cx="56" cy="68" r="3.5" fill="currentColor" />
      <circle cx="66" cy="56" r="3.5" fill="currentColor" opacity="0.6" />
      <circle cx="74" cy="62" r="3.5" fill="currentColor" opacity="0.6" />
      {/* Kanal-Signal über dem Objekt */}
      <path d="M60 22a14 14 0 0 1 0 12" {...STROKE} opacity="0.35" />
      <path d="M68 16a24 24 0 0 1 0 24" {...STROKE} opacity="0.2" />
    </svg>
  );
}

/** Betrieb vereinfachen: ein Belegungsplan, in dem alles zusammenläuft. */
export function IllustrationOperations({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      {/* Aufhängung */}
      <path d="M32 12v10M64 12v10" {...STROKE} opacity="0.55" />
      {/* Rahmen + Kopfzeile */}
      <rect x="14" y="20" width="68" height="62" rx="10" {...STROKE} />
      <path d="M14 38h68" {...STROKE} />
      {/* Belegungsbalken */}
      <rect x="24" y="47" width="30" height="8" rx="4" fill="currentColor" />
      <rect
        x="58"
        y="47"
        width="14"
        height="8"
        rx="4"
        fill="currentColor"
        opacity="0.4"
      />
      <rect
        x="24"
        y="61"
        width="18"
        height="8"
        rx="4"
        fill="currentColor"
        opacity="0.4"
      />
      <rect
        x="46"
        y="61"
        width="26"
        height="8"
        rx="4"
        fill="currentColor"
        opacity="0.7"
      />
      {/* Erledigt-Marke, sitzt auf der unteren Rahmenkante */}
      <circle cx="70" cy="82" r="14" fill="var(--card)" />
      <circle cx="70" cy="82" r="14" {...STROKE} />
      <path d="M63.5 82l4.5 4.5L77 77.5" {...STROKE} />
    </svg>
  );
}

/** Fair & europäisch: Schutzschild mit dem europäischen Sternenkreis. */
export function IllustrationEurope({ className }: Props) {
  // Sternenkreis wie in der Europaflagge — weiter außen, damit in der Mitte
  // Platz für das Häkchen bleibt und die Punkte nicht als Cluster lesen.
  const stars = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return {
      cx: 48 + 21 * Math.cos(angle),
      cy: 47 + 21 * Math.sin(angle),
    };
  });

  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path
        d="M48 10l30 11v25c0 17-12 29-30 36-18-7-30-19-30-36V21z"
        {...STROKE}
      />
      {stars.map((s) => (
        <circle
          key={`${s.cx}-${s.cy}`}
          cx={s.cx}
          cy={s.cy}
          r="2.3"
          fill="currentColor"
          opacity="0.75"
        />
      ))}
      <path d="M39 47l7 7 13-14" {...STROKE} />
    </svg>
  );
}
