// Der Kopf eines Baukasten-Unterpunkts: Titel + Erklärung + eine Aktion.
//
// Er lag in `einstellungen/rahmen.tsx` und hieß `EinstellungenKopf`, obwohl SEO,
// Objekte, Widgets und Adresse ihn genauso benutzen — 14 Aufrufer, davon 6 aus
// dem SEO-Ordner. Ein Bauteil, das nach einem Bereich heißt, in dem es nur
// zufällig entstanden ist, wird beim nächsten Mal ein zweites Mal gebaut.
import type { ReactNode } from "react";

export function BereichsKopf({
  titel,
  beschreibung,
  aktion,
}: {
  titel: string;
  beschreibung: string;
  /** Rechts neben dem Titel — meist der Knopf, der hier etwas anlegt. */
  aktion?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold">{titel}</h1>
        <p className="pt-1 text-sm text-muted-foreground">{beschreibung}</p>
      </div>
      {aktion ? <div className="shrink-0">{aktion}</div> : null}
    </div>
  );
}
