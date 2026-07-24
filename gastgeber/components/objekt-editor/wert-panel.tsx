"use client";

// Read-only-Anzeige eines Editor-Abschnitts (Airbnb-Stil): große Überschrift +
// der Wert in einer Karte. Für Abschnitte, deren Bearbeitung an anderer Stelle
// liegt (Objekttyp/Gäste/Ausstattung) oder die noch kein Property-Feld haben
// (dann „Noch nicht hinterlegt" — kein erfundener Wert, Wurzel 4).
export function WertPanel({ titel, wert }: { titel: string; wert: string }) {
  return (
    <section className="max-w-2xl">
      <h2 className="mb-6 font-sans text-[2rem] font-bold tracking-tight">{titel}</h2>
      <div className="rounded-2xl border border-border p-6">
        <p className="text-[0.9375rem] leading-relaxed text-foreground">{wert}</p>
      </div>
    </section>
  );
}
