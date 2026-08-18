// Fixe untere Aktionsleiste für Inserat und Checkout (Airbnb-Muster: Preis
// links, Haupt-Knopf rechts). Sie steht ÜBER der Tab-Leiste, weil sie die
// Aufgabe der Seite trägt — deshalb `bottom-[var(--tabbar-h)]`, nicht `bottom-0`.
//
// Nur unter `md`: ab da steht das Buchungs-Widget wieder als Spalte daneben und
// eine zweite Leiste wäre eine doppelte Bedienung derselben Sache.
"use client";

export function StickyAktionsleiste({
  links,
  rechts,
  ueberTabLeiste = true,
}: {
  /** Linke Seite — Preis, Summe, Hinweis. */
  links: React.ReactNode;
  /** Rechte Seite — der Haupt-Knopf. */
  rechts: React.ReactNode;
  /** `false`, wenn die Seite keine Tab-Leiste hat (Checkout). */
  ueberTabLeiste?: boolean;
}) {
  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-border bg-background px-4 py-3 md:hidden"
      style={{
        bottom: ueberTabLeiste
          ? "calc(var(--tabbar-h) + var(--safe-b))"
          : "0",
        paddingBottom: ueberTabLeiste ? "0.75rem" : "calc(0.75rem + var(--safe-b))",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-sm">{links}</div>
        <div className="shrink-0">{rechts}</div>
      </div>
    </div>
  );
}
