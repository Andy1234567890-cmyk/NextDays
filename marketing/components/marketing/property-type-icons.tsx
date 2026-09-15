// Piktogramme der Objekttypen (Zielgruppen-Reihe).
//
// Eigene Zeichnungen im selben Stil wie components/marketing/illustrations.tsx:
// Linien in `currentColor`, viewBox 48×48, keine Stock-Assets. Vorher stand
// dort eine reine Text-Pill-Reihe — mit Bild wird auf einen Blick klar, dass
// die Plattform vom Zelt bis zum Hotel dieselbe Einheit verwaltet.
type Props = { className?: string };

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Hotel — mehrgeschossiger Bau mit Fensterraster und Fahne. */
export function TypeHotel(p: Props) {
  return (
    <Frame {...p}>
      <path d="M6 42h36" {...S} opacity="0.35" />
      <path d="M12 42V14h24v28" {...S} />
      <path d="M24 14V8m0 0h7l-2 3 2 3h-7" {...S} />
      <path d="M18 21h4m4 0h4M18 28h4m4 0h4" {...S} opacity="0.6" />
      <path d="M21 42v-7h6v7" {...S} />
    </Frame>
  );
}

/** B&B — Haus mit dampfender Tasse. */
export function TypeBnb(p: Props) {
  return (
    <Frame {...p}>
      <path d="M6 42h36" {...S} opacity="0.35" />
      <path d="m8 24 12-11 12 11" {...S} />
      <path d="M11 24v18h18V24" {...S} />
      <path d="M17 42v-8h6v8" {...S} opacity="0.6" />
      <path d="M34 30h6a3 3 0 0 1 0 6h-1" {...S} />
      <path d="M28 30h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" {...S} />
      <path d="M33 24v-3M38 24v-3" {...S} opacity="0.5" />
    </Frame>
  );
}

/** Gästehaus — breites Haus mit Vordach und zwei Fenstern. */
export function TypeGaestehaus(p: Props) {
  return (
    <Frame {...p}>
      <path d="M6 42h36" {...S} opacity="0.35" />
      <path d="m6 22 18-12 18 12" {...S} />
      <path d="M10 22v20h28V22" {...S} />
      <path d="M20 42v-9h8v9" {...S} />
      <path d="M15 28h4M29 28h4" {...S} opacity="0.6" />
    </Frame>
  );
}

/** Motel — flacher Riegel mit Vordach und Stellplatz. */
export function TypeMotel(p: Props) {
  return (
    <Frame {...p}>
      <path d="M4 42h40" {...S} opacity="0.35" />
      <path d="M8 42V20h26v22" {...S} />
      <path d="M6 20h30" {...S} />
      <path d="M13 42v-8h6v8M25 42v-8h6v8" {...S} opacity="0.6" />
      <path d="M34 14h8v8" {...S} />
      <path d="M38 22v20" {...S} opacity="0.5" />
    </Frame>
  );
}

/** Lodge — Blockhaus mit Baum. */
export function TypeLodge(p: Props) {
  return (
    <Frame {...p}>
      <path d="M4 42h40" {...S} opacity="0.35" />
      <path d="m8 24 11-10 11 10" {...S} />
      <path d="M11 24v18h16V24" {...S} />
      <path d="M11 30h16M11 36h16" {...S} opacity="0.5" />
      <path d="M38 42V30" {...S} />
      <path d="m38 30 5-6-5-8-5 8z" {...S} />
    </Frame>
  );
}

/** Ferienwohnung — Wohnhaus mit Balkon. */
export function TypeFerienwohnung(p: Props) {
  return (
    <Frame {...p}>
      <path d="M6 42h36" {...S} opacity="0.35" />
      <path d="M13 42V10h22v32" {...S} />
      <path d="M19 17h4M27 17h4" {...S} opacity="0.6" />
      <path d="M17 26h14v6H17z" {...S} />
      <path d="M17 29h14" {...S} opacity="0.5" />
      <path d="M22 42v-6h4v6" {...S} />
    </Frame>
  );
}

/** Resort — Gebäude mit Palme und Wasserlinie. */
export function TypeResort(p: Props) {
  return (
    <Frame {...p}>
      <path d="M4 42h40" {...S} opacity="0.35" />
      <path d="M10 42V22h18v20" {...S} />
      <path d="M14 29h4m6 0h-2" {...S} opacity="0.6" />
      <path d="M17 42v-7h5v7" {...S} opacity="0.6" />
      <path d="M37 42V24" {...S} />
      <path d="M37 24c-4-3-7-2-8 0 3-1 5 0 6 1M37 24c4-3 7-2 8 0-3-1-5 0-6 1M37 24c0-4 2-6 4-6-2 2-2 4-2 5"
        {...S}
      />
    </Frame>
  );
}

/** Hütte — A-Frame mit Fenster. */
export function TypeHuette(p: Props) {
  return (
    <Frame {...p}>
      <path d="M4 42h40" {...S} opacity="0.35" />
      <path d="M24 8 8 42h32z" {...S} />
      <path d="m24 20-7 14h14z" {...S} opacity="0.55" />
      <path d="M24 34v8" {...S} opacity="0.55" />
    </Frame>
  );
}

/** Pension — Haus mit Aushängeschild. */
export function TypePension(p: Props) {
  return (
    <Frame {...p}>
      <path d="M4 42h40" {...S} opacity="0.35" />
      <path d="m9 22 12-10 12 10" {...S} />
      <path d="M12 22v20h18V22" {...S} />
      <path d="M18 42v-8h6v8" {...S} opacity="0.6" />
      <path d="M33 18v6" {...S} />
      <path d="M30 24h12v8H30z" {...S} />
      <path d="M34 28h4" {...S} opacity="0.5" />
    </Frame>
  );
}

export const TYPE_ICONS = {
  hotel: TypeHotel,
  bnb: TypeBnb,
  gaestehaus: TypeGaestehaus,
  motel: TypeMotel,
  lodge: TypeLodge,
  ferienwohnung: TypeFerienwohnung,
  resort: TypeResort,
  huette: TypeHuette,
  pension: TypePension,
} as const;
