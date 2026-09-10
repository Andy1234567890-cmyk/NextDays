// Illustrationen der zehn Funktionsgruppen auf der Preisseite.
//
// WARUM ZEICHNUNGEN STATT ICONS:
// Die erste Fassung setzte eine 16-px-Glyphe je Gruppe — auf einer Seite, die
// den vollen Funktionsumfang beweisen soll, wirkte das wie eine Aufzählung im
// Kleingedruckten. Eine gezeichnete Szene je Gruppe zeigt, WAS die Funktion
// tut, und trägt die Fläche optisch (dieselbe Entscheidung wie in
// `marketing/illustrations.tsx` für die drei Kernnutzen — hier fortgeführt,
// damit die Seite eine Handschrift hat und keine zweite Bildsprache).
//
// Machart wie dort: eigene Zeichnungen (keine Stock-Assets), 96×96-Raster,
// Linien in `currentColor`, damit sie die Akzentfarbe ihres Kreises erben.
// Deckkraft als SVG-Attribut, weil Tailwinds Arbitrary-Opacity in v4
// unzuverlässig kompiliert.
type Props = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Property-Management: Belegungsplan mit Balken über einem Kalenderraster. */
function Pms({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="12" y="18" width="72" height="60" rx="8" {...STROKE} />
      <path d="M12 34h72" {...STROKE} />
      <path d="M30 12v10M66 12v10" {...STROKE} />
      <rect x="20" y="42" width="30" height="8" rx="4" fill="currentColor" opacity="0.85" />
      <rect x="54" y="42" width="22" height="8" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="20" y="56" width="18" height="8" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="42" y="56" width="34" height="8" rx="4" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

/** Channel-Manager: ein Objekt, das auf mehrere Portale ausstrahlt. */
function Channel({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <circle cx="48" cy="48" r="12" {...STROKE} />
      <circle cx="48" cy="48" r="4" fill="currentColor" />
      <circle cx="18" cy="24" r="7" {...STROKE} />
      <circle cx="78" cy="24" r="7" {...STROKE} />
      <circle cx="18" cy="72" r="7" {...STROKE} />
      <circle cx="78" cy="72" r="7" {...STROKE} />
      <path d="m39 40-14-11M57 40l14-11M39 56l-14 11M57 56l14 11" {...STROKE} opacity="0.5" />
    </svg>
  );
}

/** Direktbuchung: Browserfenster mit Buchungsknopf. */
function Direkt({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="12" y="20" width="72" height="56" rx="8" {...STROKE} />
      <path d="M12 34h72" {...STROKE} />
      <circle cx="22" cy="27" r="2" fill="currentColor" />
      <circle cx="30" cy="27" r="2" fill="currentColor" opacity="0.5" />
      <rect x="22" y="44" width="30" height="5" rx="2.5" fill="currentColor" opacity="0.3" />
      <rect x="22" y="54" width="20" height="5" rx="2.5" fill="currentColor" opacity="0.3" />
      <rect x="56" y="44" width="20" height="20" rx="10" fill="currentColor" opacity="0.85" />
      <path d="m61 54 4 4 7-8" fill="none" stroke="var(--card, #fff)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Preise & Umsatz: Kurve mit Min-/Max-Korridor. */
function Preise({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 78h68" {...STROKE} opacity="0.3" />
      <path d="M14 34c12 0 12 18 24 18s12-22 24-22 10 14 20 14" {...STROKE} opacity="0.25" />
      <path d="M14 62c12 0 12-14 24-14s12 16 24 16 10-22 20-22" {...STROKE} />
      <circle cx="38" cy="48" r="3.5" fill="currentColor" />
      <circle cx="62" cy="64" r="3.5" fill="currentColor" opacity="0.6" />
      <circle cx="82" cy="42" r="3.5" fill="currentColor" />
    </svg>
  );
}

/** Gästeerlebnis: zwei Sprechblasen, eine davon beantwortet. */
function Gaeste({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 26h44a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H32l-12 10V56h-6a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6Z" {...STROKE} />
      <path d="M28 38h20M28 47h12" {...STROKE} opacity="0.45" />
      <path d="M74 40h8a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4h-4v8l-9-8h-1" {...STROKE} opacity="0.55" />
    </svg>
  );
}

/** Zahlungen: Karte mit Häkchen. */
function Zahlungen({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="10" y="26" width="62" height="42" rx="8" {...STROKE} />
      <path d="M10 40h62" {...STROKE} />
      <rect x="20" y="50" width="16" height="5" rx="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="72" cy="66" r="16" fill="currentColor" opacity="0.9" />
      <path d="m65 66 5 5 10-11" fill="none" stroke="var(--card, #fff)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Team & Rollen: drei Personen, eine hervorgehoben. */
function Team({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <circle cx="48" cy="32" r="11" {...STROKE} />
      <path d="M28 72c0-11 9-18 20-18s20 7 20 18" {...STROKE} />
      <circle cx="20" cy="42" r="8" {...STROKE} opacity="0.45" />
      <path d="M8 70c0-8 5-13 12-13" {...STROKE} opacity="0.45" />
      <circle cx="76" cy="42" r="8" {...STROKE} opacity="0.45" />
      <path d="M88 70c0-8-5-13-12-13" {...STROKE} opacity="0.45" />
    </svg>
  );
}

/** Mobile App: Telefon mit Kalenderkarte. */
function App({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="30" y="10" width="36" height="76" rx="10" {...STROKE} />
      <path d="M42 18h12" {...STROKE} opacity="0.5" />
      <rect x="38" y="30" width="20" height="6" rx="3" fill="currentColor" opacity="0.85" />
      <rect x="38" y="42" width="14" height="6" rx="3" fill="currentColor" opacity="0.35" />
      <rect x="38" y="54" width="20" height="6" rx="3" fill="currentColor" opacity="0.35" />
      <circle cx="48" cy="76" r="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/** Auswertungen: Säulen mit Trendpfeil. */
function Auswertungen({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 80h68" {...STROKE} opacity="0.3" />
      <rect x="20" y="54" width="12" height="26" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="40" y="42" width="12" height="38" rx="4" fill="currentColor" opacity="0.6" />
      <rect x="60" y="28" width="12" height="52" rx="4" fill="currentColor" opacity="0.9" />
      <path d="M18 34 34 22l10 8 20-16" {...STROKE} />
      <path d="M56 14h10v10" {...STROKE} />
    </svg>
  );
}

/** Buchhaltung: Rechnung mit gebuchter Zeile. */
function Buchhaltung({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M22 12h42l12 12v60H22z" {...STROKE} />
      <path d="M64 12v12h12" {...STROKE} />
      <path d="M32 40h32M32 52h32M32 64h18" {...STROKE} opacity="0.4" />
      <circle cx="70" cy="70" r="13" fill="currentColor" opacity="0.9" />
      <path d="m64 70 4 4 8-9" fill="none" stroke="var(--card, #fff)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Hotel: Rezeptionstresen mit Glocke. */
function Hotel({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M14 78h68" {...STROKE} />
      <path d="M20 78V44h26v34" {...STROKE} />
      <path d="M46 78V26h30v52" {...STROKE} opacity="0.55" />
      <path d="M28 54h10M28 64h10M56 38h10M56 52h10M56 66h10" {...STROKE} opacity="0.35" />
      <path d="M56 22a10 10 0 0 1 20 0" {...STROKE} opacity="0.25" />
    </svg>
  );
}

/** Avatar: Gesicht im Sprechfeld mit Schallwellen — KI, die antwortet. */
function Avatar({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <rect x="12" y="18" width="52" height="44" rx="10" {...STROKE} />
      <path d="M28 62v12l14-12" {...STROKE} />
      <circle cx="30" cy="36" r="3.5" fill="currentColor" />
      <circle cx="46" cy="36" r="3.5" fill="currentColor" />
      <path d="M30 48c4 3.5 12 3.5 16 0" {...STROKE} opacity="0.55" />
      <path d="M74 30a18 18 0 0 1 0 36" {...STROKE} opacity="0.45" />
      <path d="M72 40a9 9 0 0 1 0 16" {...STROKE} opacity="0.3" />
    </svg>
  );
}

/** Marktplatz: Marktstand mit Gästen davor (myBestDays). */
function Marktplatz({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M18 34h60l6 12H12l6-12Z" {...STROKE} />
      <path d="M20 46v30h56V46" {...STROKE} />
      <path d="M34 76V58h16v18" {...STROKE} opacity="0.55" />
      <path d="M60 58h12v10H60z" {...STROKE} opacity="0.4" />
      <path d="M40 34V20h16v14" {...STROKE} opacity="0.35" />
      <circle cx="48" cy="14" r="4" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/**
 * Schlüssel der Funktionsgruppe (`features.gruppen.*`) → Zeichnung.
 * Fehlt ein Schlüssel, wird nichts gezeichnet statt ein falsches Motiv zu
 * zeigen — dasselbe Prinzip wie bei fehlenden Beträgen.
 */
/**
 * KI-Antworten: eine eingehende Gastnachricht (links), aus der eine Antwort
 * entsteht (rechts) — dazwischen der Funke, der die Umwandlung markiert.
 *
 * Bewusst KEIN Roboterkopf und kein Gehirn: beide Bilder behaupten Denken.
 * Was das Produkt tut, ist eine Frage in eine belegte Antwort zu überführen —
 * also zeigt die Zeichnung genau diese zwei Sprechblasen.
 */
function Ki({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      {/* Frage des Gastes */}
      <path
        d="M10 26a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H24l-8 8V46a6 6 0 0 1-6-6z"
        {...STROKE}
      />
      <path d="M20 30h14M20 37h9" {...STROKE} opacity="0.5" />
      {/* Antwort des Systems — gefüllt, weil sie das Ergebnis ist */}
      <path
        d="M52 56a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H72l8 8-16-8h-6a6 6 0 0 1-6-6z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Funke: die Umwandlung zwischen Frage und Antwort */}
      <path d="M50 24l3.5 7.5L61 35l-7.5 3.5L50 46l-3.5-7.5L39 35l7.5-3.5z" fill="currentColor" />
      <path d="M74 22l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

/**
 * KI-Regeln: drei Themenzeilen, je mit einem Schalter — zwei an, einer aus.
 *
 * Eigene Zeichnung, weil der Beleg-Block der KI-Seite sonst DIESELBE Szene
 * zeigt wie ihr Hero. Auf allen anderen Seiten trennt die echte Aufnahme die
 * beiden Stellen; hier gibt es noch keine, also trennt sie das Motiv.
 */
function KiRegeln({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      {[22, 46, 70].map((y, i) => (
        <g key={y}>
          <rect x="8" y={y - 9} width="80" height="18" rx="9" {...STROKE} opacity="0.35" />
          {/* Thema links */}
          <rect x="17" y={y - 3} width={[22, 16, 26][i]} height="6" rx="3" fill="currentColor" opacity="0.55" />
          {/* Schalter rechts: die ersten zwei an, der dritte aus */}
          <rect
            x="60"
            y={y - 6}
            width="22"
            height="12"
            rx="6"
            fill="currentColor"
            opacity={i < 2 ? 0.85 : 0.18}
          />
          <circle cx={i < 2 ? 76 : 66} cy={y} r="4" fill="var(--color-card, #fff)" />
        </g>
      ))}
    </svg>
  );
}

/** Eigentümer-Abrechnung: ein Beleg, dessen Summe sich in zwei Anteile teilt.
 *
 *  Die zwei Balken unten sind der Kern der Funktion — aus einer Buchung wird
 *  der Anteil des Eigentümers und der des Betriebs. Deshalb kein Geldschein
 *  und kein Personen-Symbol: gezeigt wird die Aufteilung, nicht der Empfänger. */
function Eigentuemer({ className }: Props) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <path d="M22 12h38l14 14v58H22z" {...STROKE} />
      <path d="M60 12v14h14" {...STROKE} />
      <path d="M32 38h32M32 48h32" {...STROKE} />
      <rect x="32" y="60" width="24" height="8" rx="4" fill="currentColor" opacity="0.85" />
      <rect x="58" y="60" width="6" height="8" rx="3" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export const GRUPPEN_ILLUSTRATION: Record<
  string,
  (props: Props) => React.ReactElement
> = {
  eigentuemer: Eigentuemer,
  pms: Pms,
  channel: Channel,
  direkt: Direkt,
  preise: Preise,
  gaeste: Gaeste,
  ki: Ki,
  kiRegeln: KiRegeln,
  zahlungen: Zahlungen,
  team: Team,
  app: App,
  auswertungen: Auswertungen,
};

/**
 * Zeichnungen der drei Provisions-Wege. Bewusst dieselbe Bildsprache wie die
 * Funktionsgruppen — zwei Stilwelten auf einer Seite lesen sich wie zwei
 * Produkte.
 */
/**
 * Zeichnungen der Zusatzmodule. `mitarbeiter` und `dynamisch` teilen sich die
 * Motive mit den Funktionsgruppen — dasselbe Thema, dieselbe Zeichnung.
 */
export const MODUL_ILLUSTRATION: Record<
  string,
  (props: Props) => React.ReactElement
> = {
  buchhaltung: Buchhaltung,
  mitarbeiter: Team,
  hotel: Hotel,
  avatar: Avatar,
  dynamisch: Preise,
};

export const PROVISION_ILLUSTRATION: Record<
  string,
  (props: Props) => React.ReactElement
> = {
  direkt: Direkt,
  portale: Channel,
  marktplatz: Marktplatz,
};
