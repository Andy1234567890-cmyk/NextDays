// Datum und Uhrzeit im Backoffice — mit FESTER Zeitzone.
//
// Warum das nötig ist: `toLocaleString("de-DE")` ohne `timeZone` nimmt die Zone
// der ausführenden Umgebung. Auf dem Server ist das UTC, im Browser die des
// Betrachters. In einer Client-Komponente rendert React beides und vergleicht —
// bei jedem Zeitstempel entsteht dann ein Hydration-Fehler (React #418,
// „args[]=text"), und React verwirft die Server-Ausgabe und rendert neu.
//
// Live aufgetreten am 18.08.2026 auf /freigaben?status=approved: die Karte
// zeigt den Einreichungszeitpunkt, und die Konsole meldete #418 bei jedem
// Laden.
//
// Feste Zone statt der des Betrachters, weil das Backoffice ein Werkzeug des
// Betreibers ist: alle im Team sollen dieselbe Uhrzeit lesen, sonst diskutieren
// zwei Kollegen über „14:20" und meinen verschiedene Momente. Europe/Copenhagen
// ist der Sitz des Betriebs (.dk), nicht die Zone des Servers.
const ZONE = "Europe/Copenhagen";
const SPRACHE = "de-DE";

/** Datum und Uhrzeit, z. B. „18.08.2026, 14:20". */
export function datumZeit(wert: string | null | undefined): string {
  if (!wert) return "—";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(SPRACHE, {
    timeZone: ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Nur das Datum, z. B. „18.08.2026". */
export function datum(wert: string | null | undefined): string {
  if (!wert) return "—";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(SPRACHE, { timeZone: ZONE });
}

/** Nur die Uhrzeit, z. B. „14:20:35". */
export function uhrzeit(wert: string | null | undefined): string {
  if (!wert) return "—";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(SPRACHE, { timeZone: ZONE });
}
