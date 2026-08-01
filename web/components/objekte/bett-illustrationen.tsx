// Illustrationen der Schlafgelegenheiten. Ein Strich-SVG je Bettentyp, damit im
// Editor auf einen Blick erkennbar ist, welches Bett gemeint ist — die reine
// Bezeichnung ("Breites Doppelbett" vs. "Extrabreites Doppelbett") trägt das
// nicht. currentColor, damit die Icons Light/Dark und Hover mitgehen.

type IconProps = { className?: string };

const BASIS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Einzelbett: eine Matratze, ein Kopfkissen. */
function Einzelbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M3 18v-4.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V18" />
      <path d="M3 18h18M4 18v2M20 18v2" />
      <rect x="6" y="8" width="6" height="3.5" rx="1" />
    </svg>
  );
}

/** Doppelbett: eine Matratze, zwei Kopfkissen. */
function Doppelbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M3 18v-4.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V18" />
      <path d="M3 18h18M4 18v2M20 18v2" />
      <rect x="5" y="8" width="6" height="3.5" rx="1" />
      <rect x="13" y="8" width="6" height="3.5" rx="1" />
    </svg>
  );
}

/** Breites Doppelbett: wie Doppelbett, mit Breitenmaß darunter. */
function BreitesDoppelbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M2.5 16.5v-4a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v4" />
      <path d="M2.5 16.5h19" />
      <rect x="4.5" y="7" width="7" height="3.5" rx="1" />
      <rect x="12.5" y="7" width="7" height="3.5" rx="1" />
      <path d="M4 20h16M4 19v2M20 19v2" />
    </svg>
  );
}

/** Extrabreites Doppelbett: Breitenmaß mit Pfeilspitzen nach außen. */
function ExtrabreitesDoppelbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M2 16.5v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4" />
      <path d="M2 16.5h20" />
      <rect x="4" y="7" width="7.5" height="3.5" rx="1" />
      <rect x="12.5" y="7" width="7.5" height="3.5" rx="1" />
      <path d="M2.5 20h19M4.5 18.5 2.5 20l2 1.5M19.5 18.5l2 1.5-2 1.5" />
    </svg>
  );
}

/** Kingsize-Bett: Doppelbett mit Krone. */
function Kingsize({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M3 19v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
      <path d="M3 19h18M4 19v2M20 19v2" />
      <rect x="5" y="9.5" width="6" height="3.5" rx="1" />
      <rect x="13" y="9.5" width="6" height="3.5" rx="1" />
      <path d="m9 6.5 1.5 2L12 5l1.5 3.5L15 6.5v2h-6z" />
    </svg>
  );
}

/** Etagenbett / Hochbett: zwei Liegeflächen übereinander. */
function Etagenbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M4 3v18M20 3v18" />
      <path d="M4 9h16M4 17h16" />
      <path d="M4 12h16" />
      <rect x="6" y="6" width="4" height="3" rx="0.8" />
      <rect x="6" y="14" width="4" height="3" rx="0.8" />
    </svg>
  );
}

/** Hochbett: eine Liegefläche oben, freier Raum darunter. */
function Hochbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M4 4v17M20 4v17" />
      <path d="M4 10h16" />
      <path d="M4 7h16" />
      <rect x="6" y="4.5" width="4" height="2.5" rx="0.8" />
      <path d="M7 13h10M7 16h6" strokeDasharray="1.5 2" />
    </svg>
  );
}

/** Schlafsofa: Sofa mit Rücken- und Armlehnen. */
function Schlafsofa({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M3 16v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5" />
      <path d="M3 16h18M5 16v2M19 16v2" />
      <path d="M6 9V7.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 7.5V9" />
      <path d="M3 12.5h18" />
    </svg>
  );
}

/** Schrankbett: Bett, das aus dem Schrank klappt. */
function Schrankbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <rect x="3" y="3" width="8" height="18" rx="1.5" />
      <path d="M8.5 11.5h.01" />
      <path d="M11 8.5h7.5a2 2 0 0 1 2 2v6.5" />
      <path d="M11 17h9.5" />
      <rect x="12.5" y="10" width="4" height="2.5" rx="0.8" />
    </svg>
  );
}

/** Kinderbett: niedriges Bett mit Gitter. */
function Kinderbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M3 18v-7M21 18v-7" />
      <path d="M3 18h18" />
      <path d="M3 14h18" />
      <path d="M7 11v3M11 11v3M15 11v3M18 11v3" />
      <path d="M4 18v2M20 18v2" />
    </svg>
  );
}

/** Babybett: Wiege mit gerundetem Boden. */
function Babybett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M4 10v5a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-5" />
      <path d="M3 10h18" />
      <path d="M7.5 10V7M12 10V5.5M16.5 10V7" />
      <path d="M9 19.5 7.5 21M15 19.5 16.5 21" />
    </svg>
  );
}

/** Ausziehbett: Liegefläche mit ausgezogener zweiter Ebene. */
function Ausziehbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M2.5 14v-3a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
      <path d="M2.5 14h15" />
      <rect x="4.5" y="6.5" width="5" height="2.5" rx="0.8" />
      <path d="M6 17.5v-1.5h13a2 2 0 0 1 2 2v1.5H6z" />
      <path d="M4 19.5h2" />
    </svg>
  );
}

/** Wasserbett: Matratze mit Wellenlinie. */
function Wasserbett({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5" />
      <path d="M3 18h18M4 18v2M20 18v2" />
      <path d="M5 14.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0" />
      <rect x="5" y="7.5" width="5" height="3" rx="1" />
    </svg>
  );
}

/** Futon / Matratze am Boden: flache Liegefläche ohne Gestell. */
function Futon({ className }: IconProps) {
  return (
    <svg {...BASIS} className={className} aria-hidden="true">
      <rect x="2.5" y="12" width="19" height="5.5" rx="2" />
      <path d="M2.5 14.5h19" />
      <rect x="5" y="8.5" width="5.5" height="3" rx="1" />
      <path d="M4 19.5h16" strokeDasharray="1.5 2" />
    </svg>
  );
}

/** Bettentyp-Slug → Illustration. Slugs sind stabil (DB-Schlüssel). */
export const BETT_ILLUSTRATION: Record<
  string,
  (props: IconProps) => React.ReactElement
> = {
  einzelbett: Einzelbett,
  doppelbett: Doppelbett,
  breites_doppelbett: BreitesDoppelbett,
  extrabreites_doppelbett: ExtrabreitesDoppelbett,
  kingsize: Kingsize,
  etagenbett: Etagenbett,
  hochbett: Hochbett,
  schlafsofa: Schlafsofa,
  schrankbett: Schrankbett,
  kinderbett: Kinderbett,
  babybett: Babybett,
  ausziehbett: Ausziehbett,
  wasserbett: Wasserbett,
  futon: Futon,
};
