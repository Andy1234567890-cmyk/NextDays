// Platzhalter-Marke: das rote Pill hinter einer Überschrift oder einem Label,
// das sagt „dieser Wert ist der Baustein <name> in einer Nachrichten-Vorlage".
//
// WARUM ZENTRAL: Die Marke steht inzwischen an drei Pflegestellen — den
// Objekt-Texten (/objekte/[id]/nachrichten), der Objektkartei (Zugang & Technik)
// und den Zahlungs-Einstellungen. Drei Kopien desselben Markups liefen
// auseinander, sobald jemand eine davon anfasst; und genau die Wiedererkennung
// IST hier die Funktion: der Betrieb soll an jeder Stelle dasselbe Zeichen für
// dieselbe Sache sehen.
//
// Der Anlass (14.08.2026): Türcode und WLAN lagen in einem anderen Hauptmenü als
// der zugehörige Text. Wer sie dort nicht fand, ließ sie leer — und jede Vorlage
// mit `{{door_code}}` blieb liegen, weil der Versand fehlende Feldwerte nicht
// überspringt, sondern gar nicht sendet.
export function Shortcode({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-1 font-mono text-xs text-accent">
      {children}
    </span>
  );
}

/** Feld-Label mit einer oder mehreren Platzhalter-Marken dahinter. */
export function FeldMitPlatzhaltern({
  label,
  codes,
  children,
}: {
  label: string;
  codes: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {codes.map((c) => (
          <Shortcode key={c}>{c}</Shortcode>
        ))}
      </span>
      {children}
    </label>
  );
}
