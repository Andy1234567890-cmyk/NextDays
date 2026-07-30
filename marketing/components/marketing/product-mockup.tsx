// Produkt-Visual für den Hero — eine stilisierte Komposition aus
// Belegungsplan, Umsatzkarte und Handy-Ansicht, gebaut aus DOM-Elementen
// (kein Bild-Asset, kein Screenshot mit echten Gästedaten).
//
// Referenz-UX (hostaway.com): der Hero zeigt rechts nicht ein Foto, sondern
// die Software selbst als übereinander gestapelte Teilansichten — Kalender im
// Hintergrund, eine kleine Kennzahlen-Karte davor, das Handy angeschnitten.
// Genau diese Schichtung, mit unseren Objekt-/Kanalfarben.
const NIGHTS = [
  { start: 0, span: 3, tone: "bg-accent" },
  { start: 4, span: 2, tone: "bg-primary" },
  { start: 1, span: 4, tone: "bg-accent/70" },
  { start: 3, span: 3, tone: "bg-primary/70" },
  { start: 0, span: 2, tone: "bg-accent/50" },
  { start: 5, span: 2, tone: "bg-primary/50" },
];

const BARS = [40, 55, 35, 70, 60, 95];

export function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      {/* Belegungsplan */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <span className="size-2.5 rounded-full bg-accent" />
          <span className="size-2.5 rounded-full bg-muted" />
          <span className="size-2.5 rounded-full bg-muted" />
          <div className="ml-3 h-2.5 w-28 rounded-full bg-muted" />
          <div className="ml-auto h-6 w-20 rounded-full bg-secondary" />
        </div>

        <div className="p-5">
          {/* Kopfzeile: Wochentage */}
          <div className="mb-3 grid grid-cols-8 gap-1.5">
            <div className="h-2 rounded-full bg-muted" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-2 rounded-full bg-muted/60" />
            ))}
          </div>

          {/* Objekt-Zeilen mit Buchungsbalken */}
          <div className="flex flex-col gap-2">
            {NIGHTS.map((n, row) => (
              <div key={row} className="grid grid-cols-8 items-center gap-1.5">
                <div className="h-3 rounded-full bg-secondary" />
                {Array.from({ length: 7 }).map((_, col) => {
                  const inBar = col >= n.start && col < n.start + n.span;
                  const isStart = col === n.start;
                  return (
                    <div key={col} className="h-7">
                      {inBar ? (
                        <div
                          className={
                            "h-full " +
                            n.tone +
                            (isStart ? " rounded-l-full" : "") +
                            (col === n.start + n.span - 1 ? " rounded-r-full" : "")
                          }
                        />
                      ) : (
                        <div className="h-full rounded-md bg-secondary/60" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kennzahlen-Karte, links überlappend — erst ab sm, sonst deckt sie auf
          schmalen Displays den halben Kalender ab. */}
      <div className="absolute -bottom-8 -left-10 hidden w-52 rounded-2xl border border-border bg-card p-4 shadow-soft sm:block">
        {/* Bewusst OHNE Betrag und Währungszeichen: die Plattform rechnet in
            der Währung des Objekts (27 Länder) — ein Beispielbetrag hier wäre
            ein Hardcode und in jeder anderen Währung falsch. */}
        <div className="h-2 w-20 rounded-full bg-muted" />
        <div className="mt-3 h-6 w-28 rounded-lg bg-surface-accent" />
        <div className="mt-4 flex h-14 items-end gap-1.5">
          {BARS.map((h, i) => (
            <div
              key={i}
              className={
                "flex-1 rounded-t-sm " + (i === BARS.length - 1 ? "bg-accent" : "bg-accent/25")
              }
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* Handy-Ansicht, rechts angeschnitten */}
      <div className="absolute -right-2 -bottom-10 hidden w-32 rounded-[1.75rem] border-4 border-primary bg-card p-2 shadow-soft sm:block sm:w-36">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-muted" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary p-2">
              <div className="size-7 shrink-0 rounded-md bg-muted" />
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full bg-muted" />
                <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-muted/60" />
              </div>
            </div>
          ))}
          <div className="h-6 rounded-full bg-accent/15" />
        </div>
      </div>
    </div>
  );
}
